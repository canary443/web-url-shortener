# route-level contract: db hiccups and missing tables degrade, never 500
import pytest
from fastapi.testclient import TestClient
from postgrest.exceptions import APIError

from api import index
from api._lib import api_keys, auth, botcheck, captcha, ratelimit


def db_error():
    # postgrest error shape for a missing relation
    return APIError({"message": "relation does not exist", "code": "42P01"})


class FakeResult:
    def __init__(self, data):
        self.data = data


class FakeQuery:
    def __init__(self, result=None, error=None):
        self._result = result
        self._error = error

    def __getattr__(self, name):
        # select, insert, upsert, delete, eq, order, limit all chain
        def chain(*args, **kwargs):
            return self

        return chain

    def execute(self):
        if self._error is not None:
            raise self._error
        return self._result


class FakeDb:
    # tables/rpcs map a name to row data, or to an exception to raise on execute
    def __init__(self, tables=None, rpcs=None):
        self.tables = tables or {}
        self.rpcs = rpcs or {}

    def table(self, name):
        value = self.tables.get(name, [])
        if isinstance(value, Exception):
            return FakeQuery(error=value)
        return FakeQuery(result=FakeResult(value))

    def rpc(self, name, params):
        value = self.rpcs.get(name, True)
        if isinstance(value, Exception):
            return FakeQuery(error=value)
        return FakeQuery(result=FakeResult(value))


AUTH = {"authorization": "Bearer test-token"}


@pytest.fixture
def make_client(monkeypatch):
    def build(db, user={"id": "user-1"}):
        monkeypatch.setattr(index, "client", lambda: db)
        monkeypatch.setattr(api_keys, "client", lambda: db)
        monkeypatch.setattr(ratelimit, "client", lambda: db)
        monkeypatch.setattr(
            auth, "user_from_token", lambda authorization: user if authorization else None
        )
        return TestClient(index.app, raise_server_exceptions=False)

    return build


def test_links_returns_rows_and_site_url(make_client):
    rows = [
        {
            "id": "1",
            "code": "abc123",
            "target_url": "https://example.com",
            "created_at": "2026-07-15T00:00:00+00:00",
            "expires_at": None,
            "clicks": 3,
        }
    ]
    client = make_client(FakeDb(tables={"links": rows}))

    resp = client.get("/api/py/links", headers=AUTH)

    assert resp.status_code == 200
    assert resp.json()["links"] == rows
    assert "site_url" in resp.json()


def test_links_survive_rate_limit_db_failure(make_client):
    # the dashboard must keep working when the rate limit rpc is down
    client = make_client(
        FakeDb(tables={"links": []}, rpcs={"check_rate_limit": db_error()})
    )

    resp = client.get("/api/py/links", headers=AUTH)

    assert resp.status_code == 200
    assert resp.json()["links"] == []


def test_logs_survive_rate_limit_db_failure(make_client):
    client = make_client(
        FakeDb(tables={"api_events": []}, rpcs={"check_rate_limit": db_error()})
    )

    resp = client.get("/api/py/logs", headers=AUTH)

    assert resp.status_code == 200


def test_logs_empty_when_table_missing(make_client):
    client = make_client(FakeDb(tables={"api_events": db_error()}))

    resp = client.get("/api/py/logs", headers=AUTH)

    assert resp.status_code == 200
    assert resp.json() == {"events": []}


def test_shorten_with_api_key_gives_503_when_table_missing(make_client):
    # a valid-looking key must not turn into a raw 500 before the migration runs
    client = make_client(FakeDb(tables={"api_keys": db_error()}), user=None)

    resp = client.post(
        "/api/py/shorten",
        json={"url": "https://example.com/page"},
        headers={"x-api-key": "lynka_someKeyValue"},
    )

    assert resp.status_code == 503


def test_shorten_with_unknown_api_key_gives_401(make_client):
    client = make_client(FakeDb(tables={"api_keys": []}), user=None)

    resp = client.post(
        "/api/py/shorten",
        json={"url": "https://example.com/page"},
        headers={"x-api-key": "lynka_unknownKey"},
    )

    assert resp.status_code == 401


def test_api_key_settings_503_when_table_missing(make_client):
    client = make_client(FakeDb(tables={"api_keys": db_error()}))

    resp = client.get("/api/py/api-key", headers=AUTH)

    assert resp.status_code == 503


BANNED_USER = {"id": "user-1", "banned_until": "2999-01-01T00:00:00Z"}
FORMERLY_BANNED = {"id": "user-1", "banned_until": "2001-01-01T00:00:00Z"}


def test_banned_user_cannot_shorten(make_client):
    client = make_client(FakeDb(), user=BANNED_USER)

    resp = client.post(
        "/api/py/shorten", json={"url": "https://example.com/x"}, headers=AUTH
    )

    assert resp.status_code == 403
    assert "suspended" in resp.json()["detail"]


def test_banned_user_gets_suspended_dashboard(make_client):
    client = make_client(FakeDb(), user=BANNED_USER)

    resp = client.get("/api/py/links", headers=AUTH)

    assert resp.status_code == 403
    assert "suspended" in resp.json()["detail"]


def test_expired_ban_no_longer_blocks(make_client):
    client = make_client(FakeDb(tables={"links": []}), user=FORMERLY_BANNED)

    resp = client.get("/api/py/links", headers=AUTH)

    assert resp.status_code == 200


@pytest.fixture
def suspicious(monkeypatch):
    # every request looks automated and the captcha feature is switched on
    monkeypatch.setattr(botcheck, "suspicion", lambda ip: "datacenter ip")
    monkeypatch.setattr(captcha, "configured", lambda: True)


def test_suspicious_anon_shorten_gets_428(make_client, suspicious):
    client = make_client(FakeDb(tables={"links": []}), user=None)

    resp = client.post("/api/py/shorten", json={"url": "https://example.com/x"})

    assert resp.status_code == 428
    assert "captcha" in resp.json()["detail"]


def test_suspicious_anon_shorten_passes_with_captcha(
    make_client, suspicious, monkeypatch
):
    monkeypatch.setattr(captcha, "verify", lambda token, ip: token == "solved")
    client = make_client(FakeDb(tables={"links": []}), user=None)

    resp = client.post(
        "/api/py/shorten",
        json={"url": "https://example.com/x"},
        headers={"x-captcha-token": "solved"},
    )

    assert resp.status_code == 200
    assert "short_url" in resp.json()


def test_bad_captcha_token_still_428(make_client, suspicious, monkeypatch):
    monkeypatch.setattr(captcha, "verify", lambda token, ip: False)
    client = make_client(FakeDb(tables={"links": []}), user=None)

    resp = client.post(
        "/api/py/shorten",
        json={"url": "https://example.com/x"},
        headers={"x-captcha-token": "forged"},
    )

    assert resp.status_code == 428


def test_signed_in_user_skips_captcha(make_client, suspicious):
    client = make_client(FakeDb(tables={"links": []}))

    resp = client.post(
        "/api/py/shorten", json={"url": "https://example.com/x"}, headers=AUTH
    )

    assert resp.status_code == 200


def test_verify_human_503_when_captcha_off(make_client, monkeypatch):
    monkeypatch.setattr(captcha, "configured", lambda: False)
    client = make_client(FakeDb())

    resp = client.post("/api/py/auth/verify-human", json={"token": "x"})

    assert resp.status_code == 503


def test_verify_human_rejects_bad_token(make_client, monkeypatch):
    monkeypatch.setattr(captcha, "configured", lambda: True)
    monkeypatch.setattr(captcha, "verify", lambda token, ip: False)
    client = make_client(FakeDb())

    resp = client.post("/api/py/auth/verify-human", json={"token": "forged"})

    assert resp.status_code == 403


def test_verify_human_sets_the_gate_cookie(make_client, monkeypatch):
    monkeypatch.setattr(captcha, "configured", lambda: True)
    monkeypatch.setattr(captcha, "verify", lambda token, ip: token == "solved")
    monkeypatch.setattr(captcha, "mint_pass", lambda: "123.abc")
    client = make_client(FakeDb())

    resp = client.post("/api/py/auth/verify-human", json={"token": "solved"})

    assert resp.status_code == 200
    cookie = resp.headers.get("set-cookie", "")
    assert "lynka_human=123.abc" in cookie
    assert "HttpOnly" in cookie
