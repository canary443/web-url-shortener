# cloudflare turnstile verification. the browser gets a token from the widget,
# we confirm it server side. unset secret means the whole captcha feature is off
import httpx

from . import config

SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify"


def configured() -> bool:
    return bool(config.TURNSTILE_SECRET)


def verify(token: str | None, ip: str) -> bool:
    if not configured():
        return True
    if not token or len(token) > 4096:
        return False
    try:
        resp = httpx.post(
            SITEVERIFY,
            data={
                "secret": config.TURNSTILE_SECRET,
                "response": token,
                "remoteip": ip,
            },
            timeout=5,
        )
    except httpx.HTTPError:
        # captcha is only demanded from suspicious traffic, so an unreachable
        # verifier rejects rather than waving the flood through
        return False
    if resp.status_code != 200:
        return False
    return bool(resp.json().get("success"))
