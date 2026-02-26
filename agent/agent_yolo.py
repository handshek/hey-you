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