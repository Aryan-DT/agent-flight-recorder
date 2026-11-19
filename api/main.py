import os
from drone import get_drone_status, read_wifi_csi
from dotenv import load_dotenv
from fastapi import FastAPI
from pydantic import BaseModel
from pydantic_ai import Agent
from pydantic_ai.models.fallback import FallbackModel
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openrouter import OpenRouterProvider

import traceroot
from traceroot import Integration

load_dotenv()
traceroot.initialize(integrations=[Integration.PYDANTIC_AI])

provider = OpenRouterProvider(api_key=os.environ["OPENROUTER_API_KEY"])

# Free models are shared and often rate-limited (HTTP 429).
# FallbackModel tries each model in order until one succeeds.
model = FallbackModel(
    OpenAIChatModel("nvidia/nemotron-3.5-lightning:free", provider=provider),
    OpenAIChatModel("nvidia/nemotron-3.5-super-vl:free", provider=provider),
    OpenAIChatModel("google/gemma-4-31b-it:free", provider=provider),
)

agent = Agent(
    model,
    system_prompt=(
        "You are the assistant for a WiFi-sensing drone. "
        "Use the tools to check the drone and answer questions about it."
    ),
    tools=[get_drone_status, read_wifi_csi],
)

app = FastAPI()


class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    reply: str


@app.get("/health")
async def health() -> dict:
    return {"ok": True}


@app.post("/chat")
async def chat(req: ChatRequest) -> ChatResponse:
    result = await agent.run(req.message)
    return ChatResponse(reply=result.output)
