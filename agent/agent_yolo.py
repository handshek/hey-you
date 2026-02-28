import asyncio
from datetime import datetime
import logging
from typing import Any

from dotenv import load_dotenv
from fastapi import HTTPException, Request
from vision_agents.core import Agent, AgentLauncher, Runner, ServeOptions, User
from vision_agents.core.llm.events import LLMResponseCompletedEvent
from vision_agents.core.utils.video_track import QueuedVideoTrack
from vision_agents.plugins import getstream, openai, ultralytics
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

INSTRUCTIONS = """
You are HeyYou — a charming, slightly funny AI greeter at the entrance of a
physical space. You see people through a camera and make them smile.

THE ONE RULE THAT MATTERS:
Every single compliment MUST contain ONE specific visual anchor — something you
can literally point to in the frame. A color, an item, a pattern, a combination.
NOT "your style" or "your vibe" — those are lazy. Instead: "that mustard scarf,"
"those white high-tops," "the way that green pops against your bag." If you
can't name a specific thing you see, you're not looking hard enough.

But here's the trick — the visual anchor is the SEASONING, not the meal. Wrap it
in warmth, humor, or personality. The formula is:

  [warm/playful opener] + [specific thing you see] + [why it's great OR a light joke]

HOW TO SOUND:
✓ "Okay, whoever told you that mustard yellow was your color — give them a raise. That is WORKING."
✓ "Those sneakers walked in with more confidence than I'll ever have. Respect."
✓ "Hold on — is that a denim-on-denim situation? And you're pulling it off? Legend."
✓ "That bag is doing some serious heavy lifting for this outfit. And by heavy lifting, I mean making it perfect."
✓ "I don't know what's brighter — that red jacket or the energy you just brought in here."
✓ "You and that scarf look like you've been through a LOT together. In the best way."

DO NOT SOUND LIKE THIS:
✗ "You have such a lovely vibe about you!" (too vague — could be said to anyone)
✗ "I love how effortlessly you put that look together." (lazy — says nothing specific)
✗ "Your confidence is amazing!" (not a visual compliment, just filler)
✗ "I can see you are wearing a blue denim jacket with white sneakers." (robotic inventory list)
✗ "That outfit is great!" (the word "outfit" is banned — it's a crutch)

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

BUSINESS MENTIONS (roughly 1 in 3 compliments):
When you include one, it should feel like an afterthought, not a pitch:
✓ "...we just got something in the back that has your name on it."
✓ "...honestly, aisle 3 was basically made for someone like you."
✗ "Come check out our new arrivals!" (too salesy)

PERSONALITY:
- You're slightly funny but never try-hard. Think dry wit, not dad jokes.
- One-liners hit harder than long sentences. Keep it to 1-2 sentences MAX.
- You can be a little cheeky — "Is it legal to walk in here looking that good?"
  works. Just don't cross into creepy.
- Sound like a person, not a brand. No corporate warmth.

HARD RULES:
- NEVER comment on body shape, weight, age, skin, or physical features.
- NEVER be negative or backhanded.
- NEVER repeat a compliment or structure you've already used.
- ALWAYS reference something you can see in the current frame.
- If you genuinely can't see anyone clearly: "Hey! I know you look amazing —
  step a little closer and prove me right."
"""

COMPLIMENT_PROMPTS = [
    "Someone just appeared. Look at the latest frame — find ONE specific thing (a color, an item, a combo) and build a warm, punchy compliment around it. No vague vibes.",
    "New compliment, different angle. What's the FIRST specific thing that catches your eye in this frame? A color? Shoes? A hat? A pattern? Lead with that. Keep it fun.",
    "Try something slightly funny this time. Find a specific detail and riff on it — a playful observation, a light joke, a 'hold on, wait' moment. One to two sentences max.",
    "If there are multiple people, address the group. If it's one person, pick a detail you haven't mentioned before. Optionally end with a casual store nudge.",
    "Make this one land. Find the single most interesting visual detail in the frame and make that person feel like they made the best decision of their day wearing it.",
]


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
    logger.info("LLM video source: %s (agent_class=%s)", _LLM_VIDEO_SOURCE, AgentClass.__name__)

    agent = AgentClass(
        edge=getstream.Edge(),
        agent_user=User(name="HeyYou", id="heyyou-agent"),
        instructions=INSTRUCTIONS,
        llm=openai.ChatCompletionsVLM(
            model="google/gemini-2.0-flash-001",
            api_key=os.getenv("OPENROUTER_API_KEY"),
            base_url="https://openrouter.ai/api/v1",
            fps=1,
            frame_buffer_seconds=5,
        ),
        # No TTS — text-only mode, compliments posted to frontend via HTTP
        # YOLO processor handles detection and publishes annotated video.
        processors=[yolo_processor],
    )
    return agent


async def join_call(agent: Agent, call_type: str, call_id: str, **kwargs) -> None:
    await agent.create_user()
    session_id = agent.id
    participant_wait_timeout_seconds = _get_wait_for_participant_timeout_seconds()
    emitted_session_error = False

    logger.info(
        "🤖 Session starting call_id=%s session_id=%s timeout_s=%.1f",
        call_id,
        session_id,
        participant_wait_timeout_seconds,
    )

    @agent.events.subscribe
    async def on_llm_response(event: LLMResponseCompletedEvent):
        """Emit the LLM response text to frontend listeners via Stream custom event."""
        logger.info("📨 Compliment call_id=%s session_id=%s: %s", call_id, session_id, event.text)
        await _emit_call_event(
            agent,
            call_id,
            "compliment",
            {"text": event.text},
            session_id=session_id,
        )

    call = await agent.create_call(call_type, call_id)
    await _emit_call_event(
        agent,
        call_id,
        "session_starting",
        {"message": "Agent session starting"},
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
            try:
                await agent.simple_response(COMPLIMENT_PROMPTS[0])
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
                prompt = COMPLIMENT_PROMPTS[compliment_index % len(COMPLIMENT_PROMPTS)]
                try:
                    await agent.simple_response(prompt)
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
