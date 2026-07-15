# resolves the current user from a supabase access token
# validation goes through the auth server, so it works with any signing setup
from datetime import datetime, timezone

import httpx

from . import config


def is_banned(user: dict | None) -> bool:
    # a pre-ban access token stays valid for up to an hour, but the user
    # object carries banned_until, so endpoints can enforce the ban instantly
    if not user:
        return False
    banned_until = user.get("banned_until")
    if not banned_until:
        return False
    try:
        until = datetime.fromisoformat(str(banned_until).replace("Z", "+00:00"))
    except ValueError:
        return False
    return until > datetime.now(timezone.utc)


def user_from_token(authorization: str | None) -> dict | None:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        return None
    try:
        resp = httpx.get(
            f"{config.SUPABASE_URL}/auth/v1/user",
            headers={
                "apikey": config.SUPABASE_ANON_KEY,
                "Authorization": f"Bearer {token}",
            },
            timeout=5,
        )
    except httpx.HTTPError:
        return None
    if resp.status_code != 200:
        return None
    return resp.json()
