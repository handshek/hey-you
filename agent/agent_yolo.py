import asyncio
from datetime import datetime
import logging
import re
from typing import Any

from dotenv import load_dotenv
from fastapi import HTTPException, Request
from vision_agents.core import Agent, AgentLauncher, Runner, ServeOptions, User
from vision_agents.core.agents.events import (
    AgentSayCompletedEvent,
    AgentSayErrorEvent,
    AgentSayStartedEvent,
)
from vision_agents.core.instructions import Instructions
from vision_agents.core.utils.video_track import QueuedVideoTrack
from vision_agents.plugins import elevenlabs, getstream, openai, ultralytics
import os

# ── VLM raw-source override ──────────────────────────────────────────────────
# By default the SDK sends the highest-priority track to the VLM, which is the
# YOLO-annotated output (priority 2). This subclass forces the VLM to watch the
# raw participant camera track instead, so the model sees actual clothing/colors
# rather than skeleton overlays.  YOLO still publishes its annotated stream for
# the debug drawer in the frontend.


class _RawSourceAgent(Agent):
    """Agent that forces the VLM to consume the raw (non-processed) video track."""

    async def _on_track_change(self, track_id: str):
        non_processed = [
            t for t in self._active_video_tracks.values() if not t.processor
        ]
        if not non_processed:
            if hasattr(self.llm, "stop_watching_video_track"):
                await self.llm.stop_watching_video_track()
            for proc in self.video_processors:
                await proc.stop_processing()
            return

        source = sorted(non_processed, key=lambda t: t.priority, reverse=True)[0]
        self._active_source_track_id = source.id

        # Still feed raw frames into processors so YOLO annotates + publishes.
        await self._track_to_video_processors(source)

        # Track the processed output for diagnostics.
        all_tracks = sorted(
            self._active_video_tracks.values(),
            key=lambda t: t.priority,
            reverse=True,
        )
        if all_tracks:
            self._active_processed_track_id = all_tracks[0].id

        # Key override: send RAW source to the VLM, not the processed track.
        if hasattr(self.llm, "watch_video_track"):
            await self.llm.watch_video_track(
                source.track, shared_forwarder=source.forwarder
            )


# Toggle: set YOLO_LLM_VIDEO_SOURCE=processed to revert to SDK default behavior.
_LLM_VIDEO_SOURCE = os.getenv("YOLO_LLM_VIDEO_SOURCE", "raw").strip().lower()

logger = logging.getLogger(__name__)

load_dotenv()

_TONE_DIRECTIVES: dict[str, str] = {
    "warm": (
        "Your tone is warm and welcoming — like a friend who's genuinely happy to see someone. "
        "Cozy, sincere, makes people feel at home. Think gentle humor, soft exclamations.\n"
        "Examples of YOUR voice:\n"
        '✓ "That mustard scarf? Honestly, it just made my whole day a little warmer."\n'
        '✓ "I love that you walked in here rocking those colors — you belong here."'
    ),
    "hype": (
        "Your tone is HIGH ENERGY — you're the hype person at the door. Exclamation marks are your "
        "friend. You gas people up. Think \"OKAY!\" and \"Let's GO!\" and genuine excitement.\n"
        "Examples of YOUR voice:\n"
        '✓ "OKAY WAIT — those sneakers just walked in and I am NOT ready! Let\'s GO!"\n'
        '✓ "Hold UP — that jacket?! You came to WIN today and honestly? Mission accomplished!"'
    ),
    "witty": (
        "Your tone is dry and clever — think quick wit, not loud humor. Understated observations, "
        "wry comparisons, the kind of compliment that makes someone smirk and then think about it.\n"
        "Examples of YOUR voice:\n"
        '✓ "That denim-on-denim situation shouldn\'t work, and yet here you are, proving physics wrong."\n'
        '✓ "I\'d say that bag is doing the heavy lifting, but honestly the whole look is pulling its weight."'
    ),
    "professional": (
        "Your tone is polished and refined — elegant warmth, not casual. Think boutique concierge, "
        "not street-corner hype man. Sophisticated but never cold. No slang.\n"
        "Examples of YOUR voice:\n"
        '✓ "That emerald accent is a wonderful choice — it catches the light beautifully."\n'
        '✓ "You have an eye for color pairing. The navy and camel work remarkably well together."'
    ),
}

_BUSINESS_TYPE_LABELS: dict[str, str] = {
    "boutique_retail": "a boutique / retail store",
    "cafe_restaurant": "a café / restaurant",
    "conference_event": "a conference / event",
    "gym_fitness": "a gym / fitness center",
    "hotel_hospitality": "a hotel / hospitality venue",
    "bookstore_library": "a bookstore / library",
    "salon_spa": "a salon / spa",
    "office_lobby": "an office lobby",
}


def build_instructions(
    space_name: str | None = None,
    business_type: str | None = None,
    tone: str | None = None,
    context: str | None = None,
) -> str:
    """Build the system instructions, customized per-space when config is available."""

    # ── Dynamic preamble ──
    preamble_parts: list[str] = []
    preamble_parts.append(
        "You are HeyYou — a charming AI greeter at the entrance of a physical space. "
        "You see people through a camera and make them smile."
    )
    if space_name:
        biz_label = _BUSINESS_TYPE_LABELS.get(business_type or "", "a physical space")
        preamble_parts.append(f"You are greeting people at \"{space_name}\", which is {biz_label}.")
        if len(space_name) > 20:
            preamble_parts.append(
                'The business name is long — when referring to it in speech, '
                'use "here", "this place", or "we" instead of the full name.'
            )
    if context:
        preamble_parts.append(f"Extra context from the business owner: {context}")

    # ── Tone directive ──
    tone_block = _TONE_DIRECTIVES.get(tone or "", _TONE_DIRECTIVES["warm"])

    # ── Core rules (unchanged) ──
    core = """\
THE ONE RULE THAT MATTERS:
Every single compliment MUST contain ONE specific visual anchor — something the
PERSON is wearing, carrying, or rocking. A color, a clothing item, an accessory,
a pattern, a combination. NOT "your style" or "your vibe" — those are lazy.
Instead: "that mustard scarf," "those white high-tops," "the way that green pops
against your bag." If you can't name a specific thing ON THE PERSON, you're not
looking hard enough.

ABOUT THE PERSON, NOT THE ROOM:
Your job is to compliment PEOPLE, not furniture, walls, plants, or decor. Never
compliment the background, the lighting, the room, or objects that aren't on/with
the person. It's fine to USE surroundings as flavor ("you walked past that neon
sign and somehow looked cooler than it") but the compliment must land on the
PERSON. If you catch yourself about to say "nice chair" or "cool painting" — stop.
That's not your job.

But here's the trick — the visual anchor is the SEASONING, not the meal. Wrap it
in your personality. The formula is:

  [opener in YOUR tone] + [specific thing you see] + [why it's great OR a light joke]

Match the voice and energy from the examples in YOUR PERSONALITY section above.
Every compliment should sound like it came from THAT character, not a generic AI.

DO NOT SOUND LIKE THIS:
✗ "You have such a lovely vibe about you!" (too vague — could be said to anyone)
✗ "I love how effortlessly you put that look together." (lazy — says nothing specific)
✗ "Your confidence is amazing!" (not a visual compliment, just filler)
✗ "I can see you are wearing a blue denim jacket with white sneakers." (robotic inventory list)
✗ "That outfit is great!" (the word "outfit" is banned — it's a crutch)
✗ "Love those plants in the background!" (you're here for PEOPLE, not decor)
✗ "That wall color really pops!" (compliment the person, never the room)

BANNED WORDS: "outfit," "ensemble," "put-together," "effortless," "stunning,"
"gorgeous," "beautiful energy," "amazing confidence." These are AI slop.
Use real, punchy, human words instead.

MULTIPLE PEOPLE:
When you see 2+ people, acknowledge the GROUP dynamic — don't just compliment
one person and ignore the others. Approaches that work:
✓ "Alright, did you two coordinate? Because that color palette is chef's kiss."
✓ "This crew walks in and suddenly the place has better lighting. How does that work?"
✓ "I see a matching-energy duo. You two didn't plan that, did you? Because it's perfect."
Pick out something the group shares (similar colors, coordinated energy, contrasting
styles that work together) rather than singling someone out.

BUSINESS MENTIONS:
Do NOT mention the business, store, or brand unless your prompt EXPLICITLY tells
you to. When you ARE told to include one, keep it to a short natural aside — never
a pitch. Use "here", "we", "this place" instead of the full business name if it's
long. Examples of good plugs:
✓ "...we've got something in the back with your name on it."
✓ "...you're gonna love what's inside, trust me."
✗ "Come check out our new arrivals!" (too salesy)
✗ "Welcome to Rambo Workouts Premium Fitness Center!" (don't force the full name)

HARD RULES:
- NEVER comment on body shape, weight, age, skin, or physical features.
- NEVER be negative or backhanded.
- NEVER repeat a compliment or structure you've already used.
- NEVER compliment background objects, furniture, decor, walls, or the room itself.
- ALWAYS compliment something on or about the PERSON — what they wear, carry, or how they move.
- ALWAYS reference something you can see in the current frame.
- If you genuinely can't see anyone clearly: "Hey! I know you look amazing —
  step a little closer and prove me right.\""""

    personality = f"""\
PERSONALITY:
{tone_block}
- Keep it to ONE sentence, 15-20 words MAX. Punchier is always better.
- You can be a little cheeky — "Is it legal to walk in here looking that good?"
  works. Just don't cross into creepy.
- Sound like a person, not a brand. No corporate warmth."""

    return "\n\n".join(preamble_parts) + "\n\n" + personality + "\n\n" + core


# Default instructions used when no space config is provided (demo mode, etc.)
DEFAULT_INSTRUCTIONS = build_instructions()

_BASE_COMPLIMENT_PROMPTS = [
    "Someone just appeared. Look at the latest frame — find ONE specific thing (a color, an item, a combo) and build a punchy compliment around it. No vague vibes.",
    "New compliment, different angle. What's the FIRST specific thing that catches your eye in this frame? A color? Shoes? A hat? A pattern? Lead with that.",
    "Try something slightly funny this time. Find a specific detail and riff on it — a playful observation, a light joke, a 'hold on, wait' moment. One to two sentences max.",
    "Make this one land. Find the single most interesting visual detail in the frame and make that person feel like they made the best decision of their day wearing it.",
]

_NUDGE_SUFFIX = (
    "\n\nIMPORTANT: This compliment MUST include a natural store/brand mention — "
    "weave in something about the business, like 'we've got something in the back "
    "that matches that energy' or 'aisle 3 was basically made for you.' Make it feel "
    "like an afterthought, not a sales pitch. But it MUST be there."
)


def _get_compliment_prompt(index: int, space_name: str | None) -> str:
    """Return a compliment prompt, adding a store-nudge suffix every 4th turn."""
    base = _BASE_COMPLIMENT_PROMPTS[index % len(_BASE_COMPLIMENT_PROMPTS)]
    if space_name and (index % 4 == 3):
        return base + _NUDGE_SUFFIX
    return base


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        return int(raw)
    except ValueError:
        logger.warning("Invalid %s=%s, falling back to %s", name, raw, default)
        return default


def _bounded_int(name: str, default: int, minimum: int, maximum: int) -> int:
    value = _env_int(name, default)
    bounded = max(minimum, min(maximum, value))
    if bounded != value:
        logger.warning(
            "%s=%s out of bounds, clamped to %s (range %s-%s)",
            name,
            value,
            bounded,
            minimum,
            maximum,
        )
    return bounded


def _deduplicate_response(text: str, max_sentences: int = 2) -> str:
    """Remove repeated sentences from degenerated LLM output.

    Vision models sometimes return the same sentence repeated 2-10x within a
    single response.  This splits on sentence-ending punctuation, keeps only
    unique sentences (case-insensitive), and caps at *max_sentences*.
    """
    sentences = re.split(r"(?<=[.!?])\s+", text.strip())
    seen: set[str] = set()
    unique: list[str] = []
    for s in sentences:
        normalized = s.strip().lower()
        if normalized and normalized not in seen:
            seen.add(normalized)
            unique.append(s.strip())
        if len(unique) >= max_sentences:
            break
    return " ".join(unique) if unique else text


def _clean_markdown_artifacts(text: str) -> str:
    """Strip common markdown formatting from LLM output."""
    # Remove bullet prefixes: "- ", "* ", "• "
    text = re.sub(r"^\s*[-*•]\s+", "", text, flags=re.MULTILINE)
    # Remove bold/italic markers: **, *, __, _
    text = re.sub(r"\*{1,2}|_{1,2}", "", text)
    # Remove leading/trailing quotes
    text = text.strip().strip('"').strip()
    # Collapse multiple spaces
    text = re.sub(r"  +", " ", text)
    return text


def _get_idle_timeout_seconds() -> float:
    raw = os.getenv("AGENT_IDLE_TIMEOUT_SECONDS", "60")
    try:
        return float(raw)
    except ValueError:
        logger.warning(
            "Invalid AGENT_IDLE_TIMEOUT_SECONDS=%s, falling back to 60", raw
        )
        return 60.0


def _get_wait_for_participant_timeout_seconds() -> float:
    raw = os.getenv("AGENT_WAIT_FOR_PARTICIPANT_TIMEOUT_SECONDS", "20")
    try:
        value = float(raw)
    except ValueError:
        logger.warning(
            "Invalid AGENT_WAIT_FOR_PARTICIPANT_TIMEOUT_SECONDS=%s, falling back to 20",
            raw,
        )
        return 20.0

    if value <= 0:
        logger.warning(
            "AGENT_WAIT_FOR_PARTICIPANT_TIMEOUT_SECONDS=%s must be > 0, falling back to 20",
            value,
        )
        return 20.0

    return value


# ── Auth helpers ───────────────────────────────────────────────────────────


def _extract_provided_secret(request: Request) -> str | None:
    secret = request.headers.get("x-agent-secret")
    if secret:
        return secret

    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        return auth.split(" ", 1)[1].strip()

    return None


def _require_service_secret(request: Request) -> None:
    expected_secret = os.getenv("AGENT_SERVICE_SECRET")

    # Local hackathon fallback: if unset, keep service open.
    if not expected_secret:
        return

    provided_secret = _extract_provided_secret(request)
    if provided_secret != expected_secret:
        raise HTTPException(status_code=401, detail="Unauthorized")


def _can_start_session(request: Request) -> None:
    _require_service_secret(request)


def _can_close_session(request: Request) -> None:
    _require_service_secret(request)


def _can_view_session(request: Request) -> None:
    _require_service_secret(request)


def _can_view_metrics(request: Request) -> None:
    _require_service_secret(request)


async def _emit_call_event(
    agent: Agent,
    call_id: str,
    event_type: str,
    data: dict[str, Any],
    session_id: str | None = None,
) -> None:
    payload = {
        "source": "heyyou-agent",
        "event_type": event_type,
        "call_id": call_id,
        "session_id": session_id,
        "data": data,
        "ts": datetime.utcnow().isoformat() + "Z",
    }

    try:
        await agent.send_custom_event(payload)
    except Exception as e:
        logger.debug("Call custom event send error (non-fatal): %s", e)


async def create_agent(**kwargs) -> Agent:
    yolo_process_fps = _bounded_int("YOLO_PROCESS_FPS", 3, 1, 5)
    yolo_output_fps = _bounded_int("YOLO_OUTPUT_FPS", 3, 1, 5)
    lite_annotations = _env_bool("YOLO_LITE_ANNOTATIONS", True)

    yolo_processor = ultralytics.YOLOPoseProcessor(
        model_path="yolo11n-pose.pt",
        conf_threshold=0.5,
        fps=yolo_process_fps,
        max_workers=4,
        enable_hand_tracking=not lite_annotations,
        enable_wrist_highlights=not lite_annotations,
    )
    # Override plugin default (1 FPS track) so debug stream is actually real-time.
    yolo_processor._video_track = QueuedVideoTrack(  # noqa: SLF001
        fps=yolo_output_fps,
        max_queue_size=yolo_output_fps * 3,
    )
    logger.info(
        "YOLO configured: process_fps=%s output_fps=%s lite_annotations=%s",
        yolo_process_fps,
        yolo_output_fps,
        lite_annotations,
    )

    AgentClass = _RawSourceAgent if _LLM_VIDEO_SOURCE == "raw" else Agent
    logger.info(
        "LLM video source: %s (agent_class=%s)",
        _LLM_VIDEO_SOURCE,
        AgentClass.__name__,
    )

    tts = None
    tts_mode = "text-only"
    elevenlabs_api_key = os.getenv("ELEVENLABS_API_KEY")
    if not elevenlabs_api_key:
        logger.warning(
            "ELEVENLABS_API_KEY is not set. Continuing in text-only mode."
        )
    else:
        try:
            tts = elevenlabs.TTS(model_id="eleven_flash_v2_5")
            tts_mode = "elevenlabs"
            logger.info("ElevenLabs TTS enabled (model_id=eleven_flash_v2_5)")
        except Exception as e:
            logger.warning(
                "Failed to initialize ElevenLabs TTS. Continuing in text-only mode: %s",
                e,
            )

    agent_kwargs: dict[str, Any] = {
        "edge": getstream.Edge(),
        "agent_user": User(name="HeyYou", id="heyyou-agent"),
        "instructions": DEFAULT_INSTRUCTIONS,
        "llm": openai.ChatCompletionsVLM(
            model="google/gemini-2.0-flash-001",
            api_key=os.getenv("OPENROUTER_API_KEY"),
            base_url="https://openrouter.ai/api/v1",
            fps=1,
            frame_buffer_seconds=5,
        ),
        # YOLO processor handles detection and publishes annotated video.
        "processors": [yolo_processor],
    }
    if tts is not None:
        agent_kwargs["tts"] = tts
        # Keep TTS deterministic for now: streaming chunks can arrive/replay out
        # of order in this flow. Synthesize from the completed response instead.
        agent_kwargs["streaming_tts"] = False

    agent = AgentClass(
        **agent_kwargs,
    )
    setattr(agent, "_heyyou_tts_mode", tts_mode)
    return agent


async def join_call(agent: Agent, call_type: str, call_id: str, **kwargs) -> None:
    await agent.create_user()
    session_id = agent.id
    participant_wait_timeout_seconds = _get_wait_for_participant_timeout_seconds()
    emitted_session_error = False
    compliment_id = 0
    is_speaking = False
    turn_lock = asyncio.Lock()
    recent_compliments: list[str] = []

    logger.info(
        "🤖 Session starting call_id=%s session_id=%s timeout_s=%.1f",
        call_id,
        session_id,
        participant_wait_timeout_seconds,
    )

    @agent.events.subscribe
    async def on_agent_say_started(event: AgentSayStartedEvent):
        nonlocal is_speaking
        is_speaking = True

    @agent.events.subscribe
    async def on_agent_say_completed(event: AgentSayCompletedEvent):
        nonlocal is_speaking
        is_speaking = False

    @agent.events.subscribe
    async def on_agent_say_error(event: AgentSayErrorEvent):
        nonlocal is_speaking
        is_speaking = False

    async def run_compliment_turn(prompt: str) -> None:
        nonlocal compliment_id
        async with turn_lock:
            # Clear accumulated conversation so the VLM works from system
            # prompt + current frames only — prevents parroting old output.
            if hasattr(agent.llm, "_conversation") and agent.llm._conversation is not None:
                agent.llm._conversation.messages.clear()

            # Inject recent compliments so the model avoids semantic repeats.
            enriched_prompt = prompt + "\n\nIMPORTANT: Reply with exactly ONE sentence, 15-20 words max. No lists, no bullet points, no multiple compliments."
            if recent_compliments:
                history = "\n".join(f'- "{c}"' for c in recent_compliments)
                enriched_prompt += (
                    "\n\nYou already said these — say something COMPLETELY different:\n"
                    + history
                )

            original_tts = getattr(agent, "tts", None)
            # Keep TTS disabled until we are ready to speak. This prevents
            # the SDK's internal LLMResponseCompletedEvent handler from
            # auto-triggering TTS while we process/emit the text first.
            setattr(agent, "tts", None)
            try:
                llm_response = await agent.llm.simple_response(enriched_prompt)
            except Exception:
                setattr(agent, "tts", original_tts)
                raise

            raw_text = str(getattr(llm_response, "text", "")).strip()
            if not raw_text:
                setattr(agent, "tts", original_tts)
                raise RuntimeError("LLM returned an empty compliment")

            # Deduplicate repeated sentences from VLM degeneration.
            full_text = _deduplicate_response(raw_text)
            full_text = _clean_markdown_artifacts(full_text)
            # Hard cap: keep only the first sentence to avoid multi-compliment TTS.
            parts = re.split(r"(?<=[.!?])\s+", full_text.strip(), maxsplit=1)
            full_text = parts[0] if parts else full_text
            if full_text != raw_text:
                logger.info(
                    "🧹 Deduped compliment: %r → %r", raw_text[:80], full_text
                )

            # Hard cap: 25 words max (safety net for verbose LLM output).
            words = full_text.split()
            if len(words) > 25:
                full_text = " ".join(words[:25]).rstrip(",;:—-") + "."
                logger.info("✂️ Trimmed compliment to 25 words")

            # Track for next turn's prompt injection.
            recent_compliments.append(full_text)
            if len(recent_compliments) > 3:
                recent_compliments.pop(0)

            compliment_id += 1
            current_compliment_id = compliment_id
            logger.info(
                "📨 Compliment call_id=%s session_id=%s compliment_id=%s: %s",
                call_id,
                session_id,
                current_compliment_id,
                full_text,
            )
            await _emit_call_event(
                agent,
                call_id,
                "compliment",
                {
                    "compliment_id": current_compliment_id,
                    "text": full_text,
                },
                session_id=session_id,
            )

            # Wait for frontend to render text. During this sleep, any deferred
            # LLMResponseCompletedEvent handlers run and see tts=None → no auto-TTS.
            await asyncio.sleep(0.3)

            # NOW restore TTS and speak — single speech path.
            setattr(agent, "tts", original_tts)
            if original_tts is not None:
                logger.info(
                    "🔊 Starting TTS compliment_id=%s call_id=%s",
                    current_compliment_id,
                    call_id,
                )
                try:
                    await agent.say(full_text)
                    logger.info(
                        "✅ TTS completed compliment_id=%s call_id=%s",
                        current_compliment_id,
                        call_id,
                    )
                except Exception as e:
                    logger.error(
                        "❌ TTS failed compliment_id=%s call_id=%s: %s",
                        current_compliment_id,
                        call_id,
                        e,
                    )
            else:
                logger.warning(
                    "⚠️ No TTS engine (original_tts is None) compliment_id=%s",
                    current_compliment_id,
                )

    call = await agent.create_call(call_type, call_id)

    # Read space config from call custom data (set by frontend before agent start).
    custom = getattr(call, "custom_data", None) or {}
    space_name = custom.get("space_name")
    business_type = custom.get("business_type")
    tone = custom.get("tone")
    space_context = custom.get("context")

    if space_name or tone or business_type:
        new_instructions = Instructions(input_text=build_instructions(
            space_name=space_name,
            business_type=business_type,
            tone=tone,
            context=space_context,
        ))
        agent.instructions = new_instructions
        agent.llm.set_instructions(new_instructions)
        logger.info(
            "📋 Space config: name=%s type=%s tone=%s context=%s",
            space_name,
            business_type,
            tone,
            (space_context or "")[:50],
        )
    else:
        logger.info("📋 No space config found, using default instructions")

    await _emit_call_event(
        agent,
        call_id,
        "session_starting",
        {"message": "Agent session starting"},
        session_id=session_id,
    )
    tts_mode = str(getattr(agent, "_heyyou_tts_mode", "unknown"))
    await _emit_call_event(
        agent,
        call_id,
        "info",
        {"message": f"Speech mode: {tts_mode}"},
        session_id=session_id,
    )
    try:
        # Exactly one join lifecycle per session.
        # If it fails, let the session end and restart via a fresh session.
        async with agent.join(call):
            logger.info(
                "🤖 Waiting for participant call_id=%s session_id=%s", call_id, session_id
            )
            try:
                await asyncio.wait_for(
                    agent.wait_for_participant(), timeout=participant_wait_timeout_seconds
                )
            except TimeoutError as timeout_error:
                detail = (
                    "No participant joined within "
                    f"{participant_wait_timeout_seconds:.0f}s"
                )
                emitted_session_error = True
                logger.warning(
                    "⚠️ %s call_id=%s session_id=%s",
                    detail,
                    call_id,
                    session_id,
                )
                await _emit_call_event(
                    agent,
                    call_id,
                    "session_error",
                    {"message": detail},
                    session_id=session_id,
                )
                raise RuntimeError(detail) from timeout_error

            await _emit_call_event(
                agent,
                call_id,
                "joined_call",
                {"message": "Participant joined. Agent active."},
                session_id=session_id,
            )

            logger.info(
                "🤖 Participant joined call_id=%s session_id=%s; buffering 3s...",
                call_id,
                session_id,
            )
            await asyncio.sleep(3)

            await _emit_call_event(
                agent,
                call_id,
                "annotation_stream_ready",
                {"message": "YOLO annotation stream ready"},
                session_id=session_id,
            )

            logger.info(
                "🤖 Giving initial compliment call_id=%s session_id=%s",
                call_id,
                session_id,
            )
            await _emit_call_event(
                agent,
                call_id,
                "participant_detected",
                {"detected": True},
                session_id=session_id,
            )
            await asyncio.sleep(1.5)
            try:
                await run_compliment_turn(_get_compliment_prompt(0, space_name))
            except Exception as e:
                logger.warning(
                    "⚠️ Initial compliment failed call_id=%s session_id=%s: %s",
                    call_id,
                    session_id,
                    e,
                )
                await _emit_call_event(
                    agent,
                    call_id,
                    "error",
                    {"message": f"Initial compliment failed: {e}"},
                    session_id=session_id,
                )

            # Give a new compliment every 25 seconds — same as agent.py
            compliment_index = 1
            while True:
                await asyncio.sleep(25)

                logger.info(
                    "🤖 Giving compliment #%s call_id=%s session_id=%s",
                    compliment_index + 1,
                    call_id,
                    session_id,
                )
                prompt = _get_compliment_prompt(compliment_index, space_name)
                if is_speaking:
                    logger.info(
                        "⏭️ Skipping compliment tick call_id=%s session_id=%s; agent still speaking",
                        call_id,
                        session_id,
                    )
                    continue
                if turn_lock.locked():
                    logger.info(
                        "⏭️ Skipping compliment tick call_id=%s session_id=%s; prior turn still active",
                        call_id,
                        session_id,
                    )
                    continue
                await _emit_call_event(
                    agent,
                    call_id,
                    "participant_detected",
                    {"detected": True},
                    session_id=session_id,
                )
                await asyncio.sleep(1.5)
                try:
                    await run_compliment_turn(prompt)
                except Exception as e:
                    logger.warning(
                        "⚠️ Compliment failed call_id=%s session_id=%s: %s",
                        call_id,
                        session_id,
                        e,
                    )
                    await _emit_call_event(
                        agent,
                        call_id,
                        "error",
                        {"message": f"Compliment failed: {e}"},
                        session_id=session_id,
                    )
                    continue

                compliment_index += 1
    except Exception as e:
        logger.warning(
            "⚠️ Agent session failed call_id=%s session_id=%s: %s",
            call_id,
            session_id,
            e,
        )
        if not emitted_session_error:
            await _emit_call_event(
                agent,
                call_id,
                "session_error",
                {"message": f"Agent session failed: {e}"},
                session_id=session_id,
            )
        raise
    finally:
        logger.info("🤖 Session stopping call_id=%s session_id=%s", call_id, session_id)
        await _emit_call_event(
            agent,
            call_id,
            "session_stopping",
            {"message": "Agent session stopping"},
            session_id=session_id,
        )


if __name__ == "__main__":
    launcher = AgentLauncher(
        create_agent=create_agent,
        join_call=join_call,
        agent_idle_timeout=_get_idle_timeout_seconds(),
        max_sessions_per_call=1,
    )
    serve_options = ServeOptions(
        can_start_session=_can_start_session,
        can_close_session=_can_close_session,
        can_view_session=_can_view_session,
        can_view_metrics=_can_view_metrics,
    )
    Runner(launcher=launcher, serve_options=serve_options).cli()
