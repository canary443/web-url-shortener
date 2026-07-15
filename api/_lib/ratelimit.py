# fixed window rate limiting backed by the check_rate_limit rpc
from .db import client


def allow(key: str, action: str, max_hits: int, window_seconds: int = 3600) -> bool:
    result = (
        client()
        .rpc(
            "check_rate_limit",
            {
                "p_key": key,
                "p_action": action,
                "p_max": max_hits,
                "p_window_seconds": window_seconds,
            },
        )
        .execute()
    )
    return bool(result.data)


def allow_read(key: str, action: str, max_hits: int, window_seconds: int = 3600) -> bool:
    # read endpoints fail open: a rate limit db hiccup must not break the dashboard.
    # write endpoints keep the strict allow() so abuse protection never silently drops
    try:
        return allow(key, action, max_hits, window_seconds)
    except Exception:
        return True
