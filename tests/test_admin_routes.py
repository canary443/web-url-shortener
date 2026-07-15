# admin endpoints: gating, gotrue calls, link management contracts
import pytest
from fastapi.testclient import TestClient

from api import index
from api._lib import admin, api_keys, auth, config, ratelimit
from test_routes import FakeDb, db_error

ADMIN = {"id": "admin-1", "email": "admin@test"}
MORTAL = {"id": "user-1", "email": "user@test"}
AUTH = {"authorization": "Bearer test-token"}


@pytest.fixture
def make_client(monkeypatch):
    def build(db=None, user=ADMIN, gotrue=None):
        db = db or FakeDb()
        monkeypatch.setattr(config, "ADMIN_EMAILS", {"admin@test"})
        monkeypatch.setattr(index, "client", lambda: db)
        monkeypatch.setattr(api_keys, "client", lambda: db)
        monkeypatch.setattr(ratelimit, "client", lambda: db)
        monkeypatch.setattr(
            auth, "user_from_token", lambda authorization: user if authorization else None
        )
        calls = []

        def fake_gotrue(method, path, payload=None):
            calls.append((method, path, payload))
            if gotrue is not None:
                return gotrue(method, path, payload)
            if path.startswith("/admin/users/"):
                return {"id": path.rsplit("/", 1)[-1], "email": "target@test"}
            return {"users": []}

        monkeypatch.setattr(admin, "_gotrue", fake_gotrue)
        return TestClient(index.app, raise_server_exceptions=False), calls

    return build


def test_admin_endpoints_need_auth(make_client):
    client, _ = make_client(user=None)
    resp = client.get("/api/py/admin/users")
    assert resp.status_code == 401


def test_admin_endpoints_reject_non_admins(make_client):
    client, _ = make_client(user=MORTAL)
    resp = client.get("/api/py/admin/users", headers=AUTH)
    assert resp.status_code == 403


def test_admin_users_lists_with_link_counts(make_client):
    def gotrue(method, path, payload):
        return {
            "users": [
                {
                    "id": "u1",
                    "email": "a@test",
                    "created_at": "2026-07-01T00:00:00Z",
                    "last_sign_in_at": None,
                    "banned_until": None,
                }
            ]
        }

    db = FakeDb(tables={"links": [{"user_id": "u1"}, {"user_id": "u1"}]})
    client, _ = make_client(db=db, gotrue=gotrue)

    resp = client.get("/api/py/admin/users", headers=AUTH)

    assert resp.status_code == 200
    users = resp.json()["users"]
    assert users[0]["email"] == "a@test"
    assert users[0]["links"] == 2


def test_suspend_sets_permanent_ban(make_client):
    client, calls = make_client()

    resp = client.post(
        "/api/py/admin/users/u9/suspend",
        json={"reason": "spam links"},
        headers=AUTH,
    )

    assert resp.status_code == 200
    ban_calls = [c for c in calls if c[0] == "PUT"]
    assert ban_calls and ban_calls[0][2] == {"ban_duration": "87600h"}


def test_suspend_with_days_converts_to_hours(make_client):
    client, calls = make_client()

    resp = client.post(
        "/api/py/admin/users/u9/suspend",
        json={"days": 7, "reason": "abuse"},
        headers=AUTH,
    )

    assert resp.status_code == 200
    ban_calls = [c for c in calls if c[0] == "PUT"]
    assert ban_calls and ban_calls[0][2] == {"ban_duration": "168h"}


def test_admin_cannot_suspend_self(make_client):
    client, _ = make_client()

    resp = client.post(
        "/api/py/admin/users/admin-1/suspend",
        json={"reason": "oops"},
        headers=AUTH,
    )

    assert resp.status_code == 422


def test_unsuspend_lifts_ban(make_client):
    client, calls = make_client()

    resp = client.post("/api/py/admin/users/u9/unsuspend", headers=AUTH)

    assert resp.status_code == 200
    ban_calls = [c for c in calls if c[0] == "PUT"]
    assert ban_calls and ban_calls[0][2] == {"ban_duration": "none"}


def test_admin_links_search_rejects_filter_injection(make_client):
    client, _ = make_client()

    resp = client.get(
        "/api/py/admin/links",
        params={"q": "a,target_url.ilike.*x*"},
        headers=AUTH,
    )

    assert resp.status_code == 422


def test_admin_can_delete_any_link(make_client):
    client, _ = make_client()

    resp = client.delete("/api/py/admin/links/some-id", headers=AUTH)

    assert resp.status_code == 200


def test_admin_users_survive_gotrue_failure(make_client):
    def gotrue(method, path, payload):
        raise RuntimeError("gotrue down")

    client, _ = make_client(gotrue=gotrue)

    resp = client.get("/api/py/admin/users", headers=AUTH)

    assert resp.status_code == 503
