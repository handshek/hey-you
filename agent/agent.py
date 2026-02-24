import asyncio
import logging
import random

from dotenv import load_dotenv
from vision_agents.core import Agent, AgentLauncher, User, Runner
from vision_agents.plugins import getstream, gemini, elevenlabs

logger = logging.getLogger(__name__)

load_dotenv()

INSTRUCTIONS = """
You are HeyYou, a friendly AI greeter installed at an entrance.
You can see people through a camera. Your ONLY job is to look at whoever
is visible on camera and deliver a warm, personalized compliment based
on what you SEE — their outfit, accessories, colors, style, hairstyle,
or vibe.

CRITICAL BEHAVIOR:
- You are PROACTIVE. Start speaking within seconds of seeing someone.
- Do NOT wait for someone to talk to you first.
- Do NOT wait for audio. You respond based on what you SEE, not what you hear.
- Speak immediately. You are a greeter, not a conversationalist.
- Every time you see someone, give them a fresh, unique compliment.
- ALWAYS look at the LATEST video frame before responding.
- When someone asks about something they're wearing (hat, glasses, jacket, etc.),
  look carefully at the CURRENT video frame to see if they're wearing it NOW.
- NEVER repeat a compliment you already gave. Each compliment must be unique.
- Focus on DIFFERENT aspects each time (outfit, color, accessories, hairstyle, vibe).

Rules:
- Be specific about what you SEE (colors, items, style, patterns)
- Keep it to 1-2 enthusiastic sentences max
- Never comment on body shape, weight, age, or physical features
- Never be negative or backhanded
- Be warm, fun, and genuine
- If you can't see anyone clearly, say "Hey there! Step a little closer so I can see your awesome look!"
"""

# Different prompts for varied compliments (like the football commentator's question list)
COMPLIMENT_PROMPTS = [
    "Look at the person in the video RIGHT NOW and give them a specific compliment about what they're wearing. Mention colors you see.",
    "Give the person a NEW compliment you haven't said before. Focus on a different detail — maybe accessories, glasses, hairstyle, or how their colors go together.",
    "Notice something NEW about the person's look. Compliment a specific item or pattern you see in the latest frame.",
    "Look at the person's overall style and vibe. Give a fresh, unique compliment that's different from anything you've said before.",
]


async def create_agent(**kwargs) -> Agent:
    agent = Agent(
        edge=getstream.Edge(),
        agent_user=User(name="HeyYou", id="heyyou-agent"),
        instructions=INSTRUCTIONS,
        llm=gemini.VLM(
            model="gemini-2.5-flash",
            fps=1,
            frame_buffer_seconds=5,
        ),
        tts=elevenlabs.TTS(model_id="eleven_flash_v2_5"),
    )
    return agent


async def join_call(agent: Agent, call_type: str, call_id: str, **kwargs) -> None:
    # Ensure the agent user exists in Stream (needed for --no-demo)
    await agent.create_user()

    call = await agent.create_call(call_type, call_id)

    async with agent.join(call):
        logger.info("🤖 Waiting for participant to join...")
        await agent.wait_for_participant()

        logger.info("🤖 Participant joined! Buffering video frames for 6s...")
        await asyncio.sleep(6)

        logger.info("🤖 Giving initial compliment...")
        await agent.simple_response(COMPLIMENT_PROMPTS[0])

        # Give a new compliment every 25 seconds
        compliment_index = 1
        while True:
            await asyncio.sleep(25)

            # Check if anyone is still in the call
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
