import os

from dotenv import load_dotenv
from fastapi import Depends, FastAPI
from pydantic import BaseModel, Field
from pydantic_ai import Agent, ModelSettings, UsageLimits
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
from judge import Verdict, build_evidence, fetch_trace, judge_agent
from limits import enforce_limits

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

# Cost guards: cap each LLM reply's length and how many LLM calls one run may
# make. Without request_limit, a confused agent could loop on tools ~50 times.
MODEL_SETTINGS = ModelSettings(max_tokens=1000)
AGENT_LIMITS = UsageLimits(request_limit=8)
JUDGE_LIMITS = UsageLimits(request_limit=4)

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
    message: str = Field(min_length=1, max_length=500)
    faults: list[Fault] = Field(default=[], max_length=4)


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
    result = await agent.run(
        message,
        deps=DroneDeps(faults=faults),
        model_settings=MODEL_SETTINGS,
        usage_limits=AGENT_LIMITS,
    )
    return result.output


@app.post("/chat", dependencies=[Depends(enforce_limits)])
async def chat(req: ChatRequest) -> ChatResponse:
    reply = await run_drone_agent(req.message, req.faults)
    return ChatResponse(reply=reply)



class JudgeRequest(BaseModel):
    trace_id: str = Field(pattern=r"^[0-9a-f]{32}$")


@traceroot.observe(name="judge_run", type="agent")
async def run_judge(trace_id: str) -> Verdict:
    traceroot.update_current_trace(tags=["judge"], metadata={"judged_trace_id": trace_id})
    trace = await fetch_trace(trace_id)
    if not trace.get("output"):
        # The agent never replied, so there is nothing for an LLM to grade.
        return Verdict(
            passed=False,
            category="run_failed",
            issues=["The run ended without a reply."],
            explanation="The agent crashed or was rate-limited before answering.",
        )
    result = await judge_agent.run(
        build_evidence(trace),
        model=model,
        model_settings=MODEL_SETTINGS,
        usage_limits=JUDGE_LIMITS,
    )
    return result.output


@app.post("/judge", dependencies=[Depends(enforce_limits)])
async def judge(req: JudgeRequest) -> Verdict:
    return await run_judge(req.trace_id)
