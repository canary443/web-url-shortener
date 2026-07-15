import base64
import importlib.util
import sys
from pathlib import Path

import httpx
import pytest


MODULE_PATH = Path(__file__).parents[1] / "tools" / "willow-mcp" / "server.py"
SPEC = importlib.util.spec_from_file_location("willow_image_server", MODULE_PATH)
assert SPEC and SPEC.loader
willow = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = willow
SPEC.loader.exec_module(willow)
REQUIRE_MULLVAD = willow._require_mullvad

PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
)


def response(status: int, *, json=None, content=None, headers=None, url="https://example.test"):
    request = httpx.Request("GET", url)
    return httpx.Response(
        status,
        json=json,
        content=content,
        headers=headers,
        request=request,
    )


class FakeClient:
    def __init__(
        self,
        post_result,
        download_result=None,
        proxy_ok=True,
        server_type="SOCKS through WireGuard",
    ):
        self.post_result = post_result
        self.download_result = download_result
        self.proxy_ok = proxy_ok
        self.server_type = server_type
        self.posts = []
        self.gets = []

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def get(self, url, **kwargs):
        self.gets.append((url, kwargs))
        if url == willow.MULLVAD_CHECK_URL:
            return response(
                200,
                json={
                    "mullvad_exit_ip": self.proxy_ok,
                    "mullvad_server_type": self.server_type,
                },
                url=url,
            )
        assert self.download_result is not None
        return self.download_result

    def post(self, url, **kwargs):
        self.posts.append((url, kwargs))
        if isinstance(self.post_result, Exception):
            raise self.post_result
        return self.post_result


@pytest.fixture(autouse=True)
def image_key(monkeypatch):
    monkeypatch.setenv("WILLOW_IMAGE_API_KEY", "image-test-key")
    monkeypatch.setattr(willow, "_require_mullvad", lambda: None)


def install_clients(monkeypatch, clients):
    created = []

    def factory(proxy):
        created.append(proxy)
        return clients[len(created) - 1]

    monkeypatch.setattr(willow, "_http_client", factory)
    return created


def test_proxy_for_exit_converts_wireguard_name():
    assert willow._proxy_for_exit("de-fra-wg-001") == (
        "socks5h://de-fra-wg-socks5-001.relays.mullvad.net:1080"
    )


@pytest.mark.parametrize("value", ["", "--help", "de-fra-001", "http://proxy"])
def test_proxy_for_exit_rejects_invalid_names(value):
    with pytest.raises(willow.GenerationError):
        willow._proxy_for_exit(value)


def test_image_key_never_falls_back_to_chat_key(monkeypatch):
    monkeypatch.delenv("WILLOW_IMAGE_API_KEY")
    monkeypatch.setenv("WILLOW_API_KEY", "chat-test-key")
    with pytest.raises(willow.GenerationError, match="WILLOW_IMAGE_API_KEY"):
        willow._api_key()


def test_require_mullvad_rejects_disconnected_state(monkeypatch):
    monkeypatch.setattr(willow, "_require_mullvad", REQUIRE_MULLVAD)

    def run(*_args, **_kwargs):
        return willow.subprocess.CompletedProcess([], 0, stdout='{"state":"disconnected"}')

    monkeypatch.setattr(willow.subprocess, "run", run)
    with pytest.raises(willow.GenerationError, match="must be connected"):
        willow._require_mullvad()


def test_429_rotates_exit_and_writes_png(monkeypatch, tmp_path):
    limited = FakeClient(response(429, json={"error": "limited"}, headers={"Retry-After": "60"}))
    success = FakeClient(response(200, json={"data": [{"b64_json": base64.b64encode(PNG).decode()}]}))
    created = install_clients(monkeypatch, [limited, success])
    sleeps = []
    monkeypatch.setattr(willow.time, "sleep", sleeps.append)

    out = tmp_path / "probe.png"
    result = willow.generate(
        "full deliberate test prompt",
        "2k",
        str(out),
        exits=("de-fra-wg-001", "nl-ams-wg-001"),
    )

    assert out.read_bytes() == PNG
    assert "cost $0.005" in result
    assert sleeps == [65]
    assert created == [
        "socks5h://de-fra-wg-socks5-001.relays.mullvad.net:1080",
        "socks5h://nl-ams-wg-socks5-001.relays.mullvad.net:1080",
    ]
    assert success.posts[0][1]["json"]["size"] == "2K"


def test_connect_error_rotates_without_cooldown(monkeypatch, tmp_path):
    request = httpx.Request("POST", f"{willow.WILLOW_BASE}/images/generations")
    failed = FakeClient(httpx.ConnectError("offline", request=request))
    success = FakeClient(response(200, json={"data": [{"b64_json": base64.b64encode(PNG).decode()}]}))
    install_clients(monkeypatch, [failed, success])
    sleeps = []
    monkeypatch.setattr(willow.time, "sleep", sleeps.append)

    willow.generate(
        "full deliberate test prompt",
        "2k",
        str(tmp_path / "probe.png"),
        exits=("de-fra-wg-001", "nl-ams-wg-001"),
    )

    assert sleeps == []


def test_direct_mode_uses_current_mullvad_tunnel(monkeypatch, tmp_path):
    success = FakeClient(
        response(200, json={"data": [{"b64_json": base64.b64encode(PNG).decode()}]}),
        server_type="WireGuard",
    )
    created = install_clients(monkeypatch, [success])

    result = willow.generate(
        "full deliberate test prompt",
        "2k",
        str(tmp_path / "probe.png"),
        direct=True,
    )

    assert created == [None]
    assert "mullvad direct" in result


def test_direct_mode_rejects_relay_exits(tmp_path):
    with pytest.raises(willow.GenerationError, match="cannot be combined"):
        willow.generate(
            "full deliberate test prompt",
            "2k",
            str(tmp_path / "probe.png"),
            exits=("de-fra-wg-001",),
            direct=True,
        )


def test_read_timeout_does_not_retry(monkeypatch, tmp_path):
    request = httpx.Request("POST", f"{willow.WILLOW_BASE}/images/generations")
    timed_out = FakeClient(httpx.ReadTimeout("ambiguous", request=request))
    unused = FakeClient(response(200, json={"data": [{"b64_json": base64.b64encode(PNG).decode()}]}))
    created = install_clients(monkeypatch, [timed_out, unused])

    with pytest.raises(willow.GenerationError, match="duplicate charge"):
        willow.generate(
            "full deliberate test prompt",
            "2k",
            str(tmp_path / "probe.png"),
            exits=("de-fra-wg-001", "nl-ams-wg-001"),
        )

    assert len(created) == 1


def test_exhausted_429s_do_not_write_or_fall_back(monkeypatch, tmp_path):
    clients = [
        FakeClient(response(429, json={"error": "limited"})),
        FakeClient(response(429, json={"error": "limited"})),
    ]
    created = install_clients(monkeypatch, clients)
    monkeypatch.setattr(willow.time, "sleep", lambda _seconds: None)
    out = tmp_path / "probe.png"

    with pytest.raises(willow.GenerationError, match="2 willow request"):
        willow.generate(
            "full deliberate test prompt",
            "2k",
            str(out),
            exits=("de-fra-wg-001", "nl-ams-wg-001"),
        )

    assert len(created) == 2
    assert not out.exists()


def test_invalid_image_does_not_replace_existing_file(monkeypatch, tmp_path):
    bad = FakeClient(response(200, json={"data": [{"b64_json": base64.b64encode(b"html").decode()}]}))
    install_clients(monkeypatch, [bad])
    out = tmp_path / "probe.png"
    out.write_bytes(b"existing")

    with pytest.raises(willow.GenerationError, match="not a png"):
        willow.generate(
            "full deliberate test prompt",
            "2k",
            str(out),
            exits=("de-fra-wg-001",),
        )

    assert out.read_bytes() == b"existing"


def test_url_download_has_no_authorization_header(monkeypatch, tmp_path):
    image_url = "https://cdn.example.test/probe.png"
    download = response(200, content=PNG, url=image_url)
    success = FakeClient(response(200, json={"data": [{"url": image_url}]}), download)
    install_clients(monkeypatch, [success])

    willow.generate(
        "full deliberate test prompt",
        "2k",
        str(tmp_path / "probe.png"),
        exits=("de-fra-wg-001",),
    )

    assert success.posts[0][1]["headers"]["Authorization"] == "Bearer image-test-key"
    cdn_get = next(call for call in success.gets if call[0] == image_url)
    assert "headers" not in cdn_get[1]


def test_proxy_check_failure_uses_next_exit(monkeypatch, tmp_path):
    unavailable = FakeClient(response(500), proxy_ok=False)
    success = FakeClient(response(200, json={"data": [{"b64_json": base64.b64encode(PNG).decode()}]}))
    created = install_clients(monkeypatch, [unavailable, success])

    willow.generate(
        "full deliberate test prompt",
        "2k",
        str(tmp_path / "probe.png"),
        exits=("de-fra-wg-001", "nl-ams-wg-001"),
    )

    assert len(created) == 2
