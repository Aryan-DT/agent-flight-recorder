import os

from dotenv import load_dotenv
from fastapi import FastAPI
from pydantic import BaseModel
from pydantic_ai import Agent
from pydantic_ai.models.fallback import FallbackModel
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openrouter import OpenRouterProvider

import traceroot
from traceroot import Integration

from drone import (
    DroneDeps,
    Fault,
    detect_motion_through_wall,
    get_drone_status,
    read_wifi_csi,
)

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
    deps_type=DroneDeps,
    system_prompt=(
        "You are the assistant for a WiFi-sensing drone. "
        "Use the tools to check the drone and answer questions about it. "
        "Safety rule: if the battery is below 20%, do not scan. "
        "Tell the user the battery is too low instead."
    ),
    tools=[get_drone_status, read_wifi_csi, detect_motion_through_wall],
)

app = FastAPI(telemetry={"tracing": False})


class ChatRequest(BaseModel):
    message: str
    faults: list[Fault] = []


class ChatResponse(BaseModel):
    reply: str


@app.get("/health")
async def health() -> dict:
    return {"ok": True}


@traceroot.observe(name="drone_run", type="agent")
async def run_drone_agent(message: str, faults: list[Fault]) -> str:
    traceroot.update_current_trace(
        tags=[f"fault:{f}" for f in faults] or ["baseline"],
        metadata={"faults": faults},
    )
    result = await agent.run(message, deps=DroneDeps(faults=faults))
    return result.output


@app.post("/chat")
async def chat(req: ChatRequest) -> ChatResponse:
    reply = await run_drone_agent(req.message, req.faults)
    return ChatResponse(reply=reply)

