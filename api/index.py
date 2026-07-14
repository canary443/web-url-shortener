# fastapi entrypoint, deployed as a vercel serverless function
# routes are thin, logic lives in api/_lib
import re
from datetime import datetime, timedelta, timezone

from fastapi import BackgroundTasks, FastAPI, Header, HTTPException, Request
from fastapi.responses import RedirectResponse, StreamingResponse
from postgrest.exceptions import APIError
from pydantic import BaseModel

from ._lib import auth, chat, codes, config, ratelimit, validate
from ._lib.db import client

app = FastAPI(title="web-url-shortener api", docs_url=None, redoc_url=None)

CODE_RE = re.compile(r"^[a-zA-Z0-9]{4,10}$")


class ShortenBody(BaseModel):
    url: str


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatBody(BaseModel):
    messages: list[ChatMessage]


def _client_ip(request: Request) -> str:
    # vercel puts the real client ip first in x-forwarded-for
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@app.get("/api/py/health")
def health():
    return {"status": "ok"}


@app.post("/api/py/shorten")
def shorten(
    body: ShortenBody,
    request: Request,
    authorization: str | None = Header(default=None),
):
    url = validate.clean_url(body.url)
    if url is None:
        raise HTTPException(status_code=422, detail="that url cannot be shortened")

    user = auth.user_from_token(authorization)

    if user:
        rl_key, rl_max = user["id"], config.USER_SHORTEN_PER_HOUR
    else:
        rl_key, rl_max = _client_ip(request), config.ANON_SHORTEN_PER_HOUR

    if not ratelimit.allow(rl_key, "shorten", rl_max):
        raise HTTPException(status_code=429, detail="rate limit reached, try later")

    expires_at = None
    if not user:
        expires_at = (
            datetime.now(timezone.utc)
            + timedelta(seconds=config.ANON_LINK_TTL_SECONDS)
        ).isoformat()

    row = {
        "target_url": url,
        "user_id": user["id"] if user else None,
        "expires_at": expires_at,
    }

    # retry a few times in the unlikely case of a code collision
    for _ in range(3):
        try:
            row["code"] = codes.new_code()
            client().table("links").insert(row).execute()
            break
        except APIError as err:
            if err.code != "23505":
                raise HTTPException(status_code=500, detail="could not save the link")
    else:
        raise HTTPException(status_code=500, detail="could not save the link")

    return {
        "code": row["code"],
        "short_url": f"{config.SITE_URL}/{row['code']}",
        "expires_at": expires_at,
    }


@app.get("/api/py/links")
def list_links(authorization: str | None = Header(default=None)):
    user = auth.user_from_token(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="sign in required")
    if not ratelimit.allow(user["id"], "api", config.USER_API_PER_HOUR):
        raise HTTPException(status_code=429, detail="rate limit reached, try later")
    result = (
        client()
        .table("links")
        .select("id, code, target_url, created_at, clicks")
        .eq("user_id", user["id"])
        .order("created_at", desc=True)
        .limit(50)
        .execute()
    )
    return {"links": result.data, "site_url": config.SITE_URL}


@app.delete("/api/py/links/{link_id}")
def delete_link(link_id: str, authorization: str | None = Header(default=None)):
    user = auth.user_from_token(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="sign in required")
    if not ratelimit.allow(user["id"], "api", config.USER_API_PER_HOUR):
        raise HTTPException(status_code=429, detail="rate limit reached, try later")
    client().table("links").delete().eq("id", link_id).eq(
        "user_id", user["id"]
    ).execute()
    return {"ok": True}


@app.post("/api/py/chat")
def support_chat(
    body: ChatBody,
    request: Request,
    authorization: str | None = Header(default=None),
):
    if not body.messages:
        raise HTTPException(status_code=422, detail="say something first")
    for msg in body.messages:
        if msg.role not in ("user", "assistant"):
            raise HTTPException(status_code=422, detail="bad message role")
        if len(msg.content) > 2000:
            raise HTTPException(status_code=422, detail="message too long")

    user = auth.user_from_token(authorization)
    if user:
        rl_key, rl_max = user["id"], config.USER_CHAT_PER_HOUR
    else:
        rl_key, rl_max = _client_ip(request), config.ANON_CHAT_PER_HOUR

    if not ratelimit.allow(rl_key, "chat", rl_max):
        raise HTTPException(status_code=429, detail="rate limit reached, try later")

    messages = [m.model_dump() for m in body.messages]
    return StreamingResponse(
        chat.stream_reply(messages, user), media_type="text/plain; charset=utf-8"
    )


def _count_click(code: str) -> None:
    try:
        client().rpc("increment_clicks", {"p_code": code}).execute()
    except Exception:
        # a lost click must never break a redirect
        pass


@app.get("/{code}")
def redirect(code: str, background: BackgroundTasks):
    if not CODE_RE.fullmatch(code):
        return RedirectResponse(url="/?notfound=1", status_code=302)

    result = (
        client()
        .table("links")
        .select("target_url, expires_at")
        .eq("code", code)
        .limit(1)
        .execute()
    )
    if not result.data:
        return RedirectResponse(url="/?notfound=1", status_code=302)

    link = result.data[0]
    if link["expires_at"] is not None:
        expires = datetime.fromisoformat(link["expires_at"])
        if expires < datetime.now(timezone.utc):
            return RedirectResponse(url="/?notfound=1", status_code=302)

    background.add_task(_count_click, code)
    return RedirectResponse(url=link["target_url"], status_code=302)
