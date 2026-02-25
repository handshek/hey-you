import asyncio
import logging

from dotenv import load_dotenv
from vision_agents.core import Agent, AgentLauncher, User, Runner
from vision_agents.core.llm.events import LLMResponseCompletedEvent
from vision_agents.plugins import getstream, openai, ultralytics
import os

logger = logging.getLogger(__name__)

load_dotenv()

# URL of the Next.js API route for agent→frontend text delivery
EVENTS_API_URL = "http://localhost:3000/api/agent-events"

INSTRUCTIONS = """
You are HeyYou, a friendly AI greeter installed at the entrance of a trendy
retail space. You can see people through a camera. Your job is to look at
whoever is visible on camera and deliver a warm, personalized compliment based
on what you SEE — their outfit, accessories, colors, style, hairstyle, or vibe.

CRITICAL BEHAVIOR:
- You are PROACTIVE. Start speaking as soon as you detect a person.
- Do NOT wait for someone to talk to you first.
- Every time you see someone, give them a fresh, unique compliment.
- ALWAYS look at the LATEST video frame before responding.
- NEVER repeat a compliment you already gave. Each compliment must be unique.
- Focus on DIFFERENT aspects each time (outfit, color, accessories, hairstyle, vibe).

BUSINESS INTEGRATION (subtle, natural):
- About 1 in 3 compliments, weave in a brief, natural mention of the store:
  "That jacket is fire! You'd love our new arrivals section — tons of styles like that."
  "Those colors are amazing on you! We've got some accessories inside that would complete that look."
- Keep it natural and non-pushy. The compliment always comes first.
- Other times, just compliment without any business mention.

Rules:
- Be specific about what you SEE (colors, items, style, patterns)
- Keep it to 1-2 enthusiastic sentences max
- Never comment on body shape, weight, age, or physical features
- Never be negative or backhanded
- Be warm, fun, and genuine
- If you can't see anyone clearly, say "Hey there! Step a little closer so I can see your awesome look!"
"""

COMPLIMENT_PROMPTS = [
    "Look at the person in the video RIGHT NOW and give them a specific compliment about what they're wearing. Mention colors you see.",
    "Give the person a NEW compliment you haven't said before. Focus on a different detail — maybe accessories, glasses, hairstyle, or how their colors go together.",
    "Notice something NEW about the person's look. Compliment a specific item or pattern you see in the latest frame. Optionally weave in a quick mention of the store.",
    "Look at the person's overall style and vibe. Give a fresh, unique compliment that's different from anything you've said before.",
    "Compliment the person AND casually mention that the store has something they'd love based on their style.",
]


async def _post_event(call_id: str, event_type: str, data: dict) -> None:
    """POST an event to the Next.js API route for the frontend to consume."""
    import aiohttp

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                EVENTS_API_URL,
                json={"call_id": call_id, "type": event_type, "data": data},
                timeout=aiohttp.ClientTimeout(total=3),
            ) as resp:
                if resp.status == 200:
                    logger.debug(f"📤 Event posted to frontend: {event_type}")
    except Exception as e:
        logger.debug(f"Event POST error (non-fatal): {e}")


async def create_agent(**kwargs) -> Agent:
    agent = Agent(
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
        # YOLO processor for pose detection (also required by SDK for video processing)
        processors=[
            ultralytics.YOLOPoseProcessor(
                model_path="yolo11n-pose.pt",
                conf_threshold=0.5,
            )
        ],
    )
    return agent


async def join_call(agent: Agent, call_type: str, call_id: str, **kwargs) -> None:
    await agent.create_user()

    call = await agent.create_call(call_type, call_id)

    @agent.events.subscribe
    async def on_llm_response(event: LLMResponseCompletedEvent):
        """POST the LLM response text to the frontend via HTTP bridge."""
        logger.info(f"📨 Compliment: {event.text}")
        await _post_event(call_id, "compliment", {"text": event.text})

    # Modeled directly on the proven agent.py pattern:
    # simple time-based loop, no detection gating.
    async with agent.join(call):
        logger.info("🤖 Waiting for participant to join...")
        await agent.wait_for_participant()

        logger.info("🤖 Participant joined! Buffering video frames for 6s...")
        await asyncio.sleep(6)

        logger.info("🤖 Giving initial compliment...")
        try:
            await agent.simple_response(COMPLIMENT_PROMPTS[0])
        except Exception as e:
            logger.warning(f"⚠️ Initial compliment failed: {e}")

        # Give a new compliment every 25 seconds — same as agent.py
        compliment_index = 1
        while True:
            await asyncio.sleep(25)

            logger.info(f"🤖 Giving compliment #{compliment_index + 1}...")
            prompt = COMPLIMENT_PROMPTS[compliment_index % len(COMPLIMENT_PROMPTS)]
            try:
                await agent.simple_response(prompt)
            except Exception as e:
                logger.warning(f"⚠️ Compliment failed: {e}")
                break

            compliment_index += 1


if __name__ == "__main__":
    Runner(AgentLauncher(create_agent=create_agent, join_call=join_call)).cli()
