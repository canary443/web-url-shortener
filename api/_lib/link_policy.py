from datetime import datetime, timedelta, timezone

from . import config


def expires_at(
    authenticated: bool,
    now: datetime | None = None,
    override_seconds: int | None = None,
) -> str:
    created_at = now or datetime.now(timezone.utc)
    if override_seconds is not None:
        ttl = override_seconds
    else:
        ttl = (
            config.USER_LINK_TTL_SECONDS
            if authenticated
            else config.ANON_LINK_TTL_SECONDS
        )
    return (created_at + timedelta(seconds=ttl)).isoformat()


def collects_clicks(user_id: str | None) -> bool:
    return user_id is not None
