import hashlib
import secrets

from .db import client

PREFIX = "lynka_"


def key_hash(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode()).hexdigest()


def create(user_id: str) -> str:
    raw_key = PREFIX + secrets.token_urlsafe(32)
    client().table("api_keys").upsert(
        {
            "user_id": user_id,
            "key_hash": key_hash(raw_key),
            "key_prefix": raw_key[:14],
            "rpm": 5,
            "link_ttl_seconds": 31 * 24 * 3600,
        },
        on_conflict="user_id",
    ).execute()
    return raw_key


def settings(user_id: str) -> dict:
    result = (
        client()
        .table("api_keys")
        .select("key_prefix, rpm, link_ttl_seconds, created_at, updated_at")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if not result.data:
        return {
            "exists": False,
            "key_prefix": None,
            "rpm": 5,
            "link_ttl_seconds": 31 * 24 * 3600,
        }
    return {"exists": True, **result.data[0]}


def owner(raw_key: str | None) -> dict | None:
    if not raw_key or not raw_key.startswith(PREFIX):
        return None
    result = (
        client()
        .table("api_keys")
        .select("user_id, rpm, link_ttl_seconds")
        .eq("key_hash", key_hash(raw_key))
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None
