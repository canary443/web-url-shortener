# admin identity and gotrue admin api calls, used by the /admin endpoints
import httpx

from . import config


def is_admin(user: dict | None) -> bool:
    if not user:
        return False
    return str(user.get("email", "")).lower() in config.ADMIN_EMAILS


def _gotrue(method: str, path: str, payload: dict | None = None) -> dict:
    # service role talks to the auth admin api directly
    resp = httpx.request(
        method,
        f"{config.SUPABASE_URL}/auth/v1{path}",
        headers={
            "apikey": config.SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {config.SUPABASE_SERVICE_ROLE_KEY}",
        },
        json=payload,
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()


def list_users(page: int = 1, per_page: int = 50) -> list[dict]:
    data = _gotrue("GET", f"/admin/users?page={page}&per_page={per_page}")
    users = data.get("users", data if isinstance(data, list) else [])
    return users if isinstance(users, list) else []


def get_user(user_id: str) -> dict:
    return _gotrue("GET", f"/admin/users/{user_id}")


def set_ban(user_id: str, duration: str) -> None:
    # duration is a go duration string, "none" lifts the ban
    _gotrue("PUT", f"/admin/users/{user_id}", {"ban_duration": duration})
