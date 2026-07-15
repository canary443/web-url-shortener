# fastapi entrypoint, deployed as a vercel serverless function
# routes are thin, logic lives in api/_lib
import re
from collections import Counter
from datetime import datetime, timezone

from fastapi import BackgroundTasks, FastAPI, Header, HTTPException, Request
from fastapi.responses import RedirectResponse
from postgrest.exceptions import APIError
from pydantic import BaseModel

from ._lib import (
    abuse,
    admin,
    api_keys,
    auth,
    botcheck,
    captcha,
    codes,
    config,
    link_policy,
    mailer,
    ratelimit,
    validate,
)
from ._lib.db import client

app = FastAPI(title="web-url-shortener api", docs_url=None, redoc_url=None)

CODE_RE = re.compile(r"^[a-zA-Z0-9]{4,10}$")


class ShortenBody(BaseModel):
    url: str
    expires_in: int | None = None


class SignupEventBody(BaseModel):
    email: str


class SuspendBody(BaseModel):
    days: int | None = None
    reason: str = ""
    delete_links: bool = False


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
    x_captcha_token: str | None = Header(default=None),
):
    url = validate.clean_url(body.url)
    if url is None:
        raise HTTPException(status_code=422, detail="that url cannot be shortened")

    user = auth.user_from_token(authorization)
    if auth.is_banned(user):
        raise HTTPException(status_code=403, detail="account suspended")
    try:
        api_owner = api_keys.owner(x_api_key)
    except Exception:
        # key lookup needs the api_keys table, honest 503 beats a raw 500
        raise HTTPException(status_code=503, detail="api keys are not ready")
    if api_owner:
        # api keys belong to accounts, a suspended account loses them too
        try:
            if auth.is_banned(admin.get_user(api_owner["user_id"])):
                raise HTTPException(status_code=403, detail="account suspended")
        except HTTPException:
            raise
        except Exception:
            pass
    user_id = api_owner["user_id"] if api_owner else user["id"] if user else None

    if x_api_key and not api_owner:
        raise HTTPException(status_code=401, detail="invalid api key")
    if body.expires_in is not None:
        raise HTTPException(status_code=422, detail="custom expiry is locked")

    if user is None and api_owner is None and captcha.configured():
        # anonymous traffic that smells automated has to solve a captcha first.
        # 428 tells the form to render the widget and retry with a token
        client_ip = _client_ip(request)
        if botcheck.suspicion(client_ip) and not captcha.verify(
            x_captcha_token, client_ip
        ):
            raise HTTPException(status_code=428, detail="captcha required")

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
    if auth.is_banned(user):
        raise HTTPException(status_code=403, detail="account suspended")
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
    if auth.is_banned(user):
        raise HTTPException(status_code=403, detail="account suspended")
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
    if auth.is_banned(user):
        raise HTTPException(status_code=403, detail="account suspended")
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


ADMIN_Q_RE = re.compile(r"^[a-zA-Z0-9._:/\-]{0,64}$")


def _require_admin(authorization: str | None) -> dict:
    user = auth.user_from_token(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="sign in required")
    if not admin.is_admin(user):
        raise HTTPException(status_code=403, detail="admin only")
    return user


def _notify_suspension(user_id: str, reason: str, days: int | None) -> None:
    # background best effort, a dead smtp must never break the admin action
    try:
        target = admin.get_user(user_id)
        email = target.get("email")
        if not email:
            return
        length = "permanently" if days is None else f"for {days} days"
        text = (
            f"your lynka account was suspended {length}.\n\n"
            + (f"reason: {reason}\n\n" if reason else "")
            + "if you believe this is a mistake, reply to this email or write to "
            "telegram @aimwork.\n"
        )
        mailer.send(email, "your lynka account was suspended", text)
    except Exception:
        pass


def _notify_reinstatement(user_id: str) -> None:
    try:
        target = admin.get_user(user_id)
        email = target.get("email")
        if not email:
            return
        mailer.send(
            email,
            "your lynka account is active again",
            "the suspension on your lynka account was lifted. your links and "
            "api access work again.\n",
        )
    except Exception:
        pass


@app.get("/api/py/admin/users")
def admin_users(page: int = 1, authorization: str | None = Header(default=None)):
    user = _require_admin(authorization)
    if not ratelimit.allow_read(user["id"], "admin", 600):
        raise HTTPException(status_code=429, detail="rate limit reached, try later")
    try:
        users = admin.list_users(page=max(1, page))
    except Exception:
        raise HTTPException(status_code=503, detail="auth admin api unavailable")
    ids = [u["id"] for u in users]
    counts: Counter[str] = Counter()
    if ids:
        try:
            rows = (
                client()
                .table("links")
                .select("user_id")
                .in_("user_id", ids)
                .limit(5000)
                .execute()
            )
            counts = Counter(row["user_id"] for row in rows.data)
        except Exception:
            pass
    return {
        "users": [
            {
                "id": u["id"],
                "email": u.get("email"),
                "created_at": u.get("created_at"),
                "last_sign_in_at": u.get("last_sign_in_at"),
                "banned_until": u.get("banned_until"),
                "links": counts.get(u["id"], 0),
            }
            for u in users
        ]
    }


@app.get("/api/py/admin/links")
def admin_links(q: str = "", authorization: str | None = Header(default=None)):
    user = _require_admin(authorization)
    if not ratelimit.allow_read(user["id"], "admin", 600):
        raise HTTPException(status_code=429, detail="rate limit reached, try later")
    if not ADMIN_Q_RE.fullmatch(q):
        raise HTTPException(status_code=422, detail="query has unsupported characters")
    query = (
        client()
        .table("links")
        .select("id, code, target_url, user_id, created_at, expires_at, clicks")
        .order("created_at", desc=True)
        .limit(50)
    )
    if q:
        query = query.or_(f"code.eq.{q},target_url.ilike.*{q}*")
    result = query.execute()
    return {"links": result.data, "site_url": config.SITE_URL}


@app.post("/api/py/admin/users/{user_id}/suspend")
def admin_suspend(
    user_id: str,
    body: SuspendBody,
    background: BackgroundTasks,
    authorization: str | None = Header(default=None),
):
    user = _require_admin(authorization)
    if not ratelimit.allow(user["id"], "admin_action", 120, 3600):
        raise HTTPException(status_code=429, detail="rate limit reached, try later")
    if user_id == user["id"]:
        raise HTTPException(status_code=422, detail="you cannot suspend yourself")
    if body.days is not None and not 1 <= body.days <= 3650:
        raise HTTPException(status_code=422, detail="days must be between 1 and 3650")
    # gotrue takes a go duration string, ten years reads as permanent
    duration = "87600h" if body.days is None else f"{body.days * 24}h"
    try:
        admin.set_ban(user_id, duration)
    except Exception:
        raise HTTPException(status_code=503, detail="auth admin api unavailable")
    deleted_links = 0
    if body.delete_links:
        try:
            result = (
                client().table("links").delete().eq("user_id", user_id).execute()
            )
            deleted_links = len(result.data or [])
        except Exception:
            pass
    background.add_task(_notify_suspension, user_id, body.reason, body.days)
    background.add_task(_log_api_event, user["id"], "suspend", None)
    return {"ok": True, "deleted_links": deleted_links, "email_queued": mailer.configured()}


@app.post("/api/py/admin/users/{user_id}/unsuspend")
def admin_unsuspend(
    user_id: str,
    background: BackgroundTasks,
    authorization: str | None = Header(default=None),
):
    user = _require_admin(authorization)
    if not ratelimit.allow(user["id"], "admin_action", 120, 3600):
        raise HTTPException(status_code=429, detail="rate limit reached, try later")
    try:
        admin.set_ban(user_id, "none")
    except Exception:
        raise HTTPException(status_code=503, detail="auth admin api unavailable")
    background.add_task(_notify_reinstatement, user_id)
    background.add_task(_log_api_event, user["id"], "unsuspend", None)
    return {"ok": True, "email_queued": mailer.configured()}


@app.delete("/api/py/admin/links/{link_id}")
def admin_delete_link(
    link_id: str,
    background: BackgroundTasks,
    authorization: str | None = Header(default=None),
):
    user = _require_admin(authorization)
    if not ratelimit.allow(user["id"], "admin_action", 120, 3600):
        raise HTTPException(status_code=429, detail="rate limit reached, try later")
    client().table("links").delete().eq("id", link_id).execute()
    background.add_task(_log_api_event, user["id"], "admin_delete", None)
    return {"ok": True}


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
