# datacenter lookup + suspicion heuristics + turnstile verification
import httpx
import pytest

from api._lib import botcheck, captcha, config, ratelimit


def test_snapshot_decodes_to_real_data():
    # the packed module must decode into a sorted, non-trivial range set
    assert len(botcheck._V4_STARTS) > 1000
    assert botcheck._V4_STARTS == sorted(botcheck._V4_STARTS)
    # 52.95.0.0/16 is amazon s3 space, stable for years
    assert botcheck.is_datacenter("52.95.110.1")


def test_lookup_edges(monkeypatch):
    # 10.0.0.0 - 10.0.255.255 as a synthetic range
    monkeypatch.setattr(botcheck, "_V4_STARTS", [167772160])
    monkeypatch.setattr(botcheck, "_V4_ENDS", [167837695])

    assert botcheck.is_datacenter("10.0.0.0")
    assert botcheck.is_datacenter("10.0.128.9")
    assert botcheck.is_datacenter("10.0.255.255")
    assert not botcheck.is_datacenter("10.1.0.0")
    assert not botcheck.is_datacenter("9.255.255.255")


def test_lookup_tolerates_garbage():
    assert not botcheck.is_datacenter("not-an-ip")
    assert not botcheck.is_datacenter("")
    assert not botcheck.is_datacenter("unknown")


def test_suspicion_datacenter(monkeypatch):
    monkeypatch.setattr(botcheck, "is_datacenter", lambda ip: True)
    assert botcheck.suspicion("1.2.3.4") == "datacenter ip"


def test_suspicion_burst(monkeypatch):
    monkeypatch.setattr(botcheck, "is_datacenter", lambda ip: False)
    monkeypatch.setattr(ratelimit, "allow_read", lambda *a, **k: False)
    assert botcheck.suspicion("1.2.3.4") == "burst"


def test_suspicion_clean(monkeypatch):
    monkeypatch.setattr(botcheck, "is_datacenter", lambda ip: False)
    monkeypatch.setattr(ratelimit, "allow_read", lambda *a, **k: True)
    assert botcheck.suspicion("1.2.3.4") is None


def test_captcha_off_when_unset(monkeypatch):
    monkeypatch.setattr(config, "TURNSTILE_SECRET", "")
    assert not captcha.configured()
    assert captcha.verify(None, "1.2.3.4")


class FakeResponse:
    def __init__(self, status_code, payload):
        self.status_code = status_code
        self._payload = payload

    def json(self):
        return self._payload


@pytest.fixture
def secret(monkeypatch):
    monkeypatch.setattr(config, "TURNSTILE_SECRET", "test-secret")


def test_captcha_missing_token_fails(secret):
    assert not captcha.verify(None, "1.2.3.4")
    assert not captcha.verify("", "1.2.3.4")


def test_captcha_success(secret, monkeypatch):
    monkeypatch.setattr(
        httpx, "post", lambda *a, **k: FakeResponse(200, {"success": True})
    )
    assert captcha.verify("token", "1.2.3.4")


def test_captcha_rejection(secret, monkeypatch):
    monkeypatch.setattr(
        httpx, "post", lambda *a, **k: FakeResponse(200, {"success": False})
    )
    assert not captcha.verify("token", "1.2.3.4")


def test_captcha_network_error_fails_closed(secret, monkeypatch):
    def boom(*a, **k):
        raise httpx.ConnectError("down")

    monkeypatch.setattr(httpx, "post", boom)
    assert not captcha.verify("token", "1.2.3.4")
