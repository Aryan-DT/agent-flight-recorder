# Agent Flight Recorder

An AI agent for my WiFi-sensing drone, built so every run can be traced, broken on purpose, and graded.

**Live demo:** _coming soon_

**The drone:** an ESP32 drone that detects people through walls from changes in WiFi signals (channel state information, CSI). I'm building it for an upcoming hackathon. Until then, the agent's tools return **simulated** sensor data.

## What it does

It follows [TraceRoot](https://github.com/traceroot-ai/traceroot)'s Trace → Detect → Verify loop:

1. **Trace.** A Pydantic AI agent answers questions using three drone tools. Every LLM call and tool call is traced with the TraceRoot Python SDK.
2. **Break.** Fault toggles in the chat inject realistic failures (table below).
3. **Inspect.** A run inspector reads traces back through TraceRoot's public API and shows each run as a span timeline with tokens, cost and errors.
4. **Verify.** An LLM judge grades a run from its tool outputs and reply. It never sees which faults were injected, so the faults can be used to check the judge.

| Fault | What it does | What you see |
|---|---|---|
| `sensor_timeout` | The WiFi sensor hangs for 2 s, then errors | Red tool spans, run fails |
| `malformed_data` | The motion tool returns truncated JSON | The agent may invent the missing numbers |
| `wrong_units` | Distance is in feet but labeled meters | **Nothing.** Every span is green; the reply says "12 m" through one wall |
| `low_battery` | Battery reads 8% | The agent should refuse to scan |

## What I learned

- **The worst failure had zero errors.** `wrong_units` never throws. The trace shows exactly what happened but can't tell you it's wrong. The judge catches it with a physics rule: one wall can't be 12 m deep.
- **An injected fault isn't a failed run.** Sometimes the agent handled malformed data honestly, or never called the broken tool. So the inspector shows "injected" vs "judged" side by side and flags disagreements instead of scoring the judge.
- **LLM output is untrusted input.** Verdicts are validated by Pydantic in Python and checked again at runtime in TypeScript, where `Boolean("false")` is `true` (the bug in traceroot#2782).
- **Trace metadata only counts on the root span.** FastAPI's built-in OpenTelemetry created the root span, so `update_current_trace()` metadata silently disappeared. Turning off FastAPI's tracing and wrapping the run in `@observe` fixed it.
- **No database.** Each judge call is itself traced as a `judge_run`, so verdicts are stored in TraceRoot and read back from there.

## How it fits together

```
Browser ──> Next.js (web/)            chat UI, run inspector
              │  shared secret + visitor IP
              ▼
            FastAPI (api/)            agent, tools, judge, rate limits
              │                ▲
              ▼                │ public API (read traces)
            TraceRoot Cloud ───┘
```

All API keys stay on the servers. The browser only talks to Next.js.

## Abuse protection

The demo is public, so the Python API:

- only accepts calls carrying a shared secret that only the Next.js server knows
- allows each visitor 10 agent or judge runs per 10 minutes, plus a daily cap for everyone
- caps each LLM reply at 1,000 tokens and each run at 8 LLM calls
- uses free OpenRouter models, falling back to another model when one is rate-limited

## Run it locally

You need Python 3.12, Node.js, a TraceRoot project API key and an OpenRouter API key.

```bash
cd api
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # then fill in the keys
uvicorn main:app --reload
```

In a second terminal:

```bash
cd web
npm install
cp .env.example .env.local  # then fill in the keys
npm run dev
```

Open http://localhost:3000.

## Deploy

- **API on Render:** root directory `api`, start command `uvicorn main:app --host 0.0.0.0 --port $PORT`, env vars from `api/.env.example`.
- **Web on Vercel:** root directory `web`, env vars from `web/.env.example`, with `PYTHON_API_URL` set to the Render URL. `API_SECRET` must match on both.

## Stack

Python 3.12, FastAPI, Pydantic AI, TraceRoot SDK, OpenRouter · Next.js 16, React 19, Tailwind CSS 4

_Personal project, not affiliated with TraceRoot._
