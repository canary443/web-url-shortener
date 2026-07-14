# support chat backed by willowapi, openai-compatible streaming
import json
from typing import Generator, Iterable

import httpx

from . import config
from .db import client

WILLOW_BASE = "https://willowapi.digital/v1"
MODEL = "gpt-5.6-luna"
MAX_TOKENS = 600
MAX_HISTORY = 12

SYSTEM_PROMPT = """you are the support assistant of s://, a small url shortener.

facts about the service:
- anyone can shorten links on the home page for free, no account needed
- anonymous links expire after one hour
- signed in users keep links forever and see click counts on the dashboard
- sign in works with github or email and password
- shortening is rate limited to prevent abuse (10 links per hour without an account, 60 with one)
- links are managed on the dashboard: copy, delete, watch clicks
- the project is open source: https://github.com/canary443/web-url-shortener

style: answer short and plain, lowercase, no marketing talk. if you do not know
something, say so and point to the github issues page. never invent features.
only discuss topics related to this service."""


def _links_context(user_id: str) -> str:
    # a few recent links so the bot can answer questions about them
    try:
        result = (
            client()
            .table("links")
            .select("code, target_url, clicks, created_at")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(5)
            .execute()
        )
    except Exception:
        return ""
    if not result.data:
        return "\n\nthe user is signed in but has no links yet."
    lines = [
        f"- /{row['code']} -> {row['target_url']} ({row['clicks']} clicks)"
        for row in result.data
    ]
    return "\n\nthe user is signed in. their recent links:\n" + "\n".join(lines)


def stream_reply(
    messages: Iterable[dict], user: dict | None
) -> Generator[str, None, None]:
    system = SYSTEM_PROMPT
    if user:
        system += _links_context(user["id"])

    trimmed = list(messages)[-MAX_HISTORY:]
    payload = {
        "model": MODEL,
        "stream": True,
        "max_tokens": MAX_TOKENS,
        "messages": [{"role": "system", "content": system}, *trimmed],
    }

    with httpx.stream(
        "POST",
        f"{WILLOW_BASE}/chat/completions",
        json=payload,
        headers={"Authorization": f"Bearer {config.WILLOW_API_KEY}"},
        timeout=60,
    ) as resp:
        if resp.status_code != 200:
            yield "support is having a moment. try again in a minute."
            return
        for line in resp.iter_lines():
            if not line.startswith("data: "):
                continue
            data = line[6:].strip()
            if data == "[DONE]":
                break
            try:
                chunk = json.loads(data)
                delta = chunk["choices"][0]["delta"].get("content")
            except (json.JSONDecodeError, KeyError, IndexError):
                continue
            if delta:
                yield delta
