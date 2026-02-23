import os
from dotenv import load_dotenv
from vision_agents.core import Agent, AgentLauncher, User, Runner
from vision_agents.plugins import getstream, gemini

load_dotenv()

INSTRUCTIONS = """
You are HeyYou, a friendly AI greeter for physical spaces.
When you see someone enter the camera frame, deliver a warm, personalized
compliment based on what you observe — their outfit, accessories, colors,
energy, posture, or group composition.

Rules:
- Be specific about what you SEE (colors, items, style)
- Keep it to 1-2 sentences max
- Never comment on body shape, weight, age, or physical features
- Never be negative or backhanded
- Weave in business context naturally when relevant
- If multiple people, acknowledge the group
- If no one is visible, stay quiet

Business context:
{context}

Tone: {tone}
"""

async def create_agent(**kwargs) -> Agent:
    return Agent(
        edge=getstream.Edge(),
        agent_user=User(name="HeyYou", id="heyyou-agent"),
        instructions=INSTRUCTIONS,
        llm=gemini.Realtime(fps=3),
    )

async def join_call(agent, call_type, call_id, **kwargs):
    call = await agent.create_call(call_type, call_id)
    async with agent.join(call):
        await agent.run()

Runner(AgentLauncher(create_agent=create_agent, join_call=join_call)).cli()
