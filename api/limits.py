"""Abuse protection for the public API.

Every /chat and /judge call costs LLM requests, and the free OpenRouter quota
is shared by every visitor. These checks run before the agent does.

The counters live in memory. That is fine for one server process (Render's
free tier runs exactly one) and they reset on restart. Several servers would
need a shared store such as Redis.
"""

import hmac
import os
import time
from collections import defaultdict, deque
from datetime import datetime, timezone

from fastapi import HTTPException, Request

VISITOR_LIMIT = 10  # LLM-backed requests per visitor...
VISITOR_WINDOW_SECONDS = 10 * 60  # ...per 10 minutes
DAILY_CAP = int(os.environ.get("DAILY_RUN_CAP", "100"))  # for everyone, per UTC day

_visitor_hits: dict[str, deque[float]] = defaultdict(deque)
_daily = {"day": "", "count": 0}


def _check_secret(request: Request) -> None:
    """Only the Next.js server knows API_SECRET, so direct calls are rejected."""
    expected = os.environ.get("API_SECRET")
    if not expected:
        return  # Not set locally, so local development works without it.
    given = request.headers.get("x-api-secret", "")
    # compare_digest takes the same time whether the first or last character is
    # wrong, so the secret can't be guessed one character at a time.
    if not hmac.compare_digest(given, expected):
        raise HTTPException(status_code=401, detail="Unauthorized.")


def _visitor_id(request: Request) -> str:
    # Next.js forwards the visitor's IP. Trusting this header is safe only
    # because _check_secret already proved the request came from Next.js.
    forwarded = request.headers.get("x-visitor-ip")
    if forwarded:
        return forwarded
    return request.client.host if request.client else "unknown"


def _check_visitor(visitor: str) -> None:
    now = time.monotonic()
    hits = _visitor_hits[visitor]
    while hits and now - hits[0] > VISITOR_WINDOW_SECONDS:
        hits.popleft()  # Forget requests older than the window.
    if len(hits) >= VISITOR_LIMIT:
        wait_minutes = int((VISITOR_WINDOW_SECONDS - (now - hits[0])) // 60) + 1
        raise HTTPException(
            status_code=429,
            detail=f"You've hit the demo limit. Try again in {wait_minutes} min.",
        )
    hits.append(now)


def _check_daily_cap() -> None:
    today = datetime.now(timezone.utc).date().isoformat()
    if _daily["day"] != today:
        _daily["day"], _daily["count"] = today, 0  # A new day resets the count.
    if _daily["count"] >= DAILY_CAP:
        raise HTTPException(
            status_code=429,
            detail="The demo has reached its daily limit. Try again tomorrow.",
        )
    _daily["count"] += 1


def enforce_limits(request: Request) -> None:
    """FastAPI dependency: runs before /chat and /judge."""
    _check_secret(request)
    _check_visitor(_visitor_id(request))
    _check_daily_cap()
