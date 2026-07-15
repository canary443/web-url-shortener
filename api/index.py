# fastapi entrypoint, deployed as a vercel serverless function
# routes are thin, logic lives in api/_lib
import re
from datetime import datetime, timezone

from fastapi import BackgroundTasks, FastAPI, Header, HTTPException, Request
from fastapi.responses import RedirectResponse
from postgrest.exceptions import APIError
from pydantic import BaseModel

from ._lib import abuse, api_keys, auth, codes, config, link_policy, ratelimit, validate
from ._lib.db import client

app = FastAPI(title="web-url-shortener api", docs_url=None, redoc_url=None)

CODE_RE = re.compile(r"^[a-zA-Z0-9]{4,10}$")


class ShortenBody(BaseModel):
    url: str
    expires_in: int | None = None


class SignupEventBody(BaseModel):
    email: str


def _client_ip(request: Request) -> str:
    # vercel puts the real client ip first in x-forwarded-for
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _log_api_event(user_id: str, action: str, code: str | None) -> None:
    # dashboard api log. the table ships with a pending migration, so a missing
    # table (or any db hiccup) must never break the actual request
    try:
        client().table("api_events").insert(
            {"user_id": user_id, "action": action, "code": code}
        ).execute()
    except Exception:
        pass


@app.get("/api/py/health")
def health():
    return {"status": "ok"}


@app.post("/api/py/auth/signup-event")
def signup_event(body: SignupEventBody, request: Request):
    ip_address = _client_ip(request)
    if not ratelimit.allow(ip_address, "signup_event", 5, 3600):
        raise HTTPException(status_code=429, detail="rate limit reached, try later")
    if not body.email.strip() or len(body.email) > 320:
        raise HTTPException(status_code=422, detail="invalid email")
    try:
        client().table("signup_events").insert(
            {
                "ip_address": ip_address,
                "email_fingerprint": abuse.email_fingerprint(body.email),
            }
        ).execute()
    except Exception:
        # abuse telemetry must never break a completed signup
        pass
    return {"ok": True}


@app.post("/api/py/shorten")
def shorten(
    body: ShortenBody,
    request: Request,
    background: BackgroundTasks,
    authorization: str | None = Header(default=None),
    x_api_key: str | None = Header(default=None),
):
    url = validate.clean_url(body.url)
    if url is None:
        raise HTTPException(status_code=422, detail="that url cannot be shortened")

    user = auth.user_from_token(authorization)
    try:
        api_owner = api_keys.owner(x_api_key)
    except Exception:
        # key lookup needs the api_keys table, honest 503 beats a raw 500
        raise HTTPException(status_code=503, detail="api keys are not ready")
    user_id = api_owner["user_id"] if api_owner else user["id"] if user else None

    if x_api_key and not api_owner:
        raise HTTPException(status_code=401, detail="invalid api key")
    if body.expires_in is not None:
        raise HTTPException(status_code=422, detail="custom expiry is locked")

    if api_owner:
        allowed = ratelimit.allow(user_id, "api_shorten", api_owner["rpm"], 60)
    elif user:
        allowed = ratelimit.allow(
            user_id, "shorten", config.USER_SHORTEN_PER_MINUTE, 60
        )
    else:
        allowed = ratelimit.allow(
            _client_ip(request), "shorten", config.ANON_SHORTEN_PER_HOUR
        )
    if not allowed:
        raise HTTPException(status_code=429, detail="rate limit reached, try later")

    expires_at = link_policy.expires_at(
        authenticated=bool(user_id),
        override_seconds=api_owner["link_ttl_seconds"] if api_owner else None,
    )

    row = {
        "target_url": url,
        "user_id": user_id,
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

    if user_id:
        background.add_task(_log_api_event, user_id, "shorten", row["code"])

    return {
        "code": row["code"],
        "short_url": f"{config.SITE_URL}/{row['code']}",
        "expires_at": expires_at,
    }


@app.get("/api/py/api-key")
def api_key_settings(authorization: str | None = Header(default=None)):
    user = auth.user_from_token(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="sign in required")
    try:
        return api_keys.settings(user["id"])
    except Exception:
        raise HTTPException(status_code=503, detail="api keys are not ready")


@app.post("/api/py/api-key")
def create_api_key(authorization: str | None = Header(default=None)):
    user = auth.user_from_token(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="sign in required")
    if not ratelimit.allow(user["id"], "api_key_create", 5, 3600):
        raise HTTPException(status_code=429, detail="rate limit reached, try later")
    try:
        raw_key = api_keys.create(user["id"])
        return {"api_key": raw_key, **api_keys.settings(user["id"])}
    except Exception:
        raise HTTPException(status_code=503, detail="api keys are not ready")


@app.get("/api/py/links")
def list_links(authorization: str | None = Header(default=None)):
    user = auth.user_from_token(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="sign in required")
    if not ratelimit.allow_read(user["id"], "api", config.USER_API_PER_HOUR):
        raise HTTPException(status_code=429, detail="rate limit reached, try later")
    result = (
        client()
        .table("links")
        .select("id, code, target_url, created_at, expires_at, clicks")
        .eq("user_id", user["id"])
        .order("created_at", desc=True)
        .limit(50)
        .execute()
    )
    return {"links": result.data, "site_url": config.SITE_URL}


@app.delete("/api/py/links/{link_id}")
def delete_link(
    link_id: str,
    background: BackgroundTasks,
    authorization: str | None = Header(default=None),
):
    user = auth.user_from_token(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="sign in required")
    if not ratelimit.allow(user["id"], "api", config.USER_API_PER_HOUR):
        raise HTTPException(status_code=429, detail="rate limit reached, try later")
    client().table("links").delete().eq("id", link_id).eq(
        "user_id", user["id"]
    ).execute()
    background.add_task(_log_api_event, user["id"], "delete", None)
    return {"ok": True}


@app.get("/api/py/logs")
def api_logs(authorization: str | None = Header(default=None)):
    user = auth.user_from_token(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="sign in required")
    if not ratelimit.allow_read(user["id"], "api", config.USER_API_PER_HOUR):
        raise HTTPException(status_code=429, detail="rate limit reached, try later")
    try:
        result = (
            client()
            .table("api_events")
            .select("action, code, created_at")
            .eq("user_id", user["id"])
            .order("created_at", desc=True)
            .limit(20)
            .execute()
        )
        events = result.data
    except Exception:
        # table not migrated yet, the dashboard shows an empty log
        events = []
    return {"events": events}


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
        .select("target_url, expires_at, user_id")
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

    if link_policy.collects_clicks(link["user_id"]):
        background.add_task(_count_click, code)
    return RedirectResponse(url=link["target_url"], status_code=302)
