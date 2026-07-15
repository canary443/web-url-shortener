# willow-image mcp server
# generates images through willowapi.digital (openai-compatible images api)
# two modes:
#   mcp stdio server (default): registered in .mcp.json, exposes generate_image
#   cli mode: python tools/willow-mcp/server.py --prompt "..." --quality 2k --out banner.png
import argparse
import base64
import binascii
import json
import math
import os
import random
import re
import struct
import subprocess
import sys
import tempfile
import time
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.parse import urlparse

import httpx

WILLOW_BASE = "https://willowapi.digital/v1"
DEFAULT_MODEL = "gpt-image-2"
PRICES = {"2k": 0.005, "4k": 0.010}
SIZES = {"2k": "2K", "4k": "4K"}

MULLVAD_CHECK_URL = "https://am.i.mullvad.net/json"
DEFAULT_MULLVAD_EXITS = (
    "at-vie-wg-101",
    "de-fra-wg-001",
    "fi-hel-wg-001",
    "pl-waw-wg-201",
)
MULLVAD_EXIT_PATTERN = re.compile(r"^[a-z]{2}-[a-z]{3}-wg-[0-9]{3}$")

# willow applies the cooldown to metadata calls too, so keep paid retries sparse
MAX_ATTEMPTS = 4
RETRY_WAIT_SECONDS = 65
MAX_RETRY_WAIT_SECONDS = 300
MAX_IMAGE_BYTES = 64 * 1024 * 1024
MAX_IMAGE_PIXELS = 100_000_000


class GenerationError(RuntimeError):
    pass


def _load_env() -> None:
    # tiny .env loader so the key works no matter how the process is launched
    env_path = Path(__file__).resolve().parents[2] / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip())


def _api_key() -> str:
    key = os.environ.get("WILLOW_IMAGE_API_KEY")
    if not key:
        raise GenerationError("WILLOW_IMAGE_API_KEY is not set, add it to .env")
    return key


def _proxy_for_exit(exit_name: str) -> str:
    exit_name = exit_name.strip().lower()
    if not MULLVAD_EXIT_PATTERN.fullmatch(exit_name):
        raise GenerationError(f"invalid mullvad exit name: {exit_name or '<empty>'}")
    prefix, number = exit_name.rsplit("-wg-", 1)
    return f"socks5h://{prefix}-wg-socks5-{number}.relays.mullvad.net:1080"


def _configured_exits(exits: tuple[str, ...] | list[str] | None = None) -> list[str]:
    use_defaults = False
    if exits:
        selected = list(exits)
    else:
        configured = os.environ.get("WILLOW_IMAGE_MULLVAD_EXITS", "")
        selected = [item.strip() for item in configured.split(",") if item.strip()]
        if not selected:
            selected = list(DEFAULT_MULLVAD_EXITS)
            use_defaults = True

    unique = list(dict.fromkeys(selected))
    if not unique:
        raise GenerationError("no mullvad exits configured")
    for exit_name in unique:
        _proxy_for_exit(exit_name)
    if use_defaults:
        random.SystemRandom().shuffle(unique)
    return unique[:MAX_ATTEMPTS]


def _require_mullvad() -> None:
    try:
        result = subprocess.run(
            ["mullvad", "status", "--json"],
            capture_output=True,
            check=True,
            text=True,
            timeout=10,
        )
        status = json.loads(result.stdout)
    except (FileNotFoundError, subprocess.SubprocessError, json.JSONDecodeError) as err:
        raise GenerationError("could not read mullvad status") from err
    if status.get("state") != "connected":
        raise GenerationError("mullvad must be connected before image generation")


def _http_client(proxy: str | None) -> httpx.Client:
    options = {
        "trust_env": False,
        "follow_redirects": True,
        "timeout": httpx.Timeout(600, connect=20),
    }
    if proxy:
        options["proxy"] = proxy
    return httpx.Client(**options)


def _verify_mullvad_proxy(client: httpx.Client, require_socks: bool = True) -> None:
    try:
        response = client.get(MULLVAD_CHECK_URL, timeout=20)
        response.raise_for_status()
        details = response.json()
    except (httpx.HTTPError, json.JSONDecodeError, ValueError) as err:
        raise GenerationError("mullvad proxy check failed") from err
    if not isinstance(details, dict):
        raise GenerationError("mullvad proxy check returned an unexpected response")
    if details.get("mullvad_exit_ip") is not True:
        raise GenerationError("proxy check did not return a mullvad exit")
    if require_socks and "SOCKS" not in str(details.get("mullvad_server_type", "")):
        raise GenerationError("proxy check did not return a mullvad socks exit")


def _response_error(response: httpx.Response) -> str:
    message = ""
    try:
        payload = response.json()
        error = payload.get("error") if isinstance(payload, dict) else None
        if isinstance(error, dict):
            message = str(error.get("message", ""))
        elif error:
            message = str(error)
        elif isinstance(payload, dict):
            message = str(payload.get("message", ""))
    except (json.JSONDecodeError, ValueError):
        message = response.text
    clean = " ".join(message.split())[:240]
    return clean or "empty error response"


def _retry_wait(response: httpx.Response) -> float:
    value = response.headers.get("Retry-After", "").strip()
    seconds = 0.0
    if value:
        try:
            seconds = float(value)
        except ValueError:
            try:
                seconds = parsedate_to_datetime(value).timestamp() - time.time()
            except (TypeError, ValueError, OverflowError):
                seconds = 0.0
    if not math.isfinite(seconds):
        seconds = 0.0
    return min(max(seconds, RETRY_WAIT_SECONDS), MAX_RETRY_WAIT_SECONDS)


def _png_dimensions(raw: bytes) -> tuple[int, int]:
    if len(raw) > MAX_IMAGE_BYTES:
        raise GenerationError("image response exceeds the 64 mb limit")
    if len(raw) < 24 or raw[:8] != b"\x89PNG\r\n\x1a\n" or raw[12:16] != b"IHDR":
        raise GenerationError("willow response is not a png image")
    width, height = struct.unpack(">II", raw[16:24])
    if width < 1 or height < 1 or width * height > MAX_IMAGE_PIXELS:
        raise GenerationError("willow returned invalid png dimensions")
    return width, height


def _image_bytes(response: httpx.Response, client: httpx.Client) -> bytes:
    try:
        payload = response.json()
    except (json.JSONDecodeError, ValueError) as err:
        raise GenerationError("willow returned malformed json") from err
    data = payload.get("data") if isinstance(payload, dict) else None
    if not isinstance(data, list) or not data or not isinstance(data[0], dict):
        raise GenerationError("willow returned an unexpected response shape")

    image = data[0]
    if image.get("b64_json"):
        encoded = image["b64_json"]
        if not isinstance(encoded, str) or len(encoded) > MAX_IMAGE_BYTES * 2:
            raise GenerationError("willow base64 image data exceeds the size limit")
        try:
            raw = base64.b64decode(encoded, validate=True)
        except (binascii.Error, ValueError, TypeError) as err:
            raise GenerationError("willow returned invalid base64 image data") from err
    elif image.get("url"):
        image_url = str(image["url"])
        if urlparse(image_url).scheme != "https":
            raise GenerationError("willow returned a non-https image url")
        try:
            download = client.get(image_url, timeout=120)
            download.raise_for_status()
        except httpx.HTTPError as err:
            raise GenerationError("could not download the generated image") from err
        raw = download.content
    else:
        raise GenerationError("willow response has no image data")

    _png_dimensions(raw)
    return raw


def _write_atomic(out: Path, raw: bytes) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix=f".{out.name}.", dir=out.parent)
    try:
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(raw)
        os.replace(temporary, out)
    except BaseException:
        Path(temporary).unlink(missing_ok=True)
        raise


def generate(
    prompt: str,
    quality: str,
    out_path: str,
    model: str = DEFAULT_MODEL,
    exits: tuple[str, ...] | list[str] | None = None,
    direct: bool = False,
) -> str:
    if quality not in PRICES:
        raise GenerationError("quality must be 2k or 4k")
    if not prompt.strip():
        raise GenerationError("prompt must not be empty")

    key = _api_key()
    if direct and exits:
        raise GenerationError("direct mode cannot be combined with mullvad exits")
    # a rotating pool proxy shields the home ip without mullvad
    custom_proxy = os.environ.get("WILLOW_IMAGE_PROXY", "").strip()
    if custom_proxy:
        if direct or exits:
            raise GenerationError(
                "WILLOW_IMAGE_PROXY cannot be combined with --direct or mullvad exits"
            )
        selected_exits: list[str | None] = [custom_proxy]
    else:
        selected_exits = [None] if direct else _configured_exits(exits)
        _require_mullvad()
    payload = {
        "model": model,
        "prompt": prompt,
        "size": SIZES[quality],
        "n": 1,
    }
    headers = {"Authorization": f"Bearer {key}"}

    last_error = "no mullvad proxy was available"
    wait_before_request = 0.0
    willow_attempts = 0
    for exit_name in selected_exits:
        if custom_proxy:
            proxy = custom_proxy
        else:
            proxy = _proxy_for_exit(exit_name) if exit_name else None
        try:
            client = _http_client(proxy)
        except (ImportError, ValueError) as err:
            raise GenerationError("mullvad socks support is not installed") from err

        with client:
            if not custom_proxy:
                try:
                    _verify_mullvad_proxy(client, require_socks=not direct)
                except GenerationError as err:
                    last_error = str(err)
                    continue

            if wait_before_request:
                time.sleep(wait_before_request)
                wait_before_request = 0.0

            try:
                response = client.post(
                    f"{WILLOW_BASE}/images/generations",
                    json=payload,
                    headers=headers,
                )
                willow_attempts += 1
            except (httpx.ProxyError, httpx.ConnectError, httpx.ConnectTimeout) as err:
                last_error = f"connection failed before dispatch: {type(err).__name__}"
                continue
            except httpx.HTTPError as err:
                raise GenerationError(
                    "willow request failed after dispatch; not retrying to avoid a duplicate charge"
                ) from err

            if response.status_code == 429:
                last_error = "rate limited by willowapi"
                wait_before_request = _retry_wait(response)
                continue
            if response.status_code != 200:
                raise GenerationError(
                    f"willow returned {response.status_code}: {_response_error(response)}"
                )

            raw = _image_bytes(response, client)
            width, height = _png_dimensions(raw)
            out = Path(out_path)
            _write_atomic(out, raw)
            return (
                f"saved {out} ({len(raw) // 1024} kb, {width}x{height}, "
                f"{quality}, cost ${PRICES[quality]:.3f}, "
                f"{'custom proxy' if custom_proxy else 'mullvad ' + ('direct' if direct else 'socks')})"
            )

    raise GenerationError(
        f"generation failed after {willow_attempts} willow request(s): {last_error}"
    )


def run_mcp(exits: tuple[str, ...] | list[str] | None = None) -> None:
    from mcp.server.fastmcp import FastMCP

    server = FastMCP("willow-image")

    @server.tool()
    def generate_image(prompt: str, quality: str = "2k", out_path: str = "image.png") -> str:
        """generates an image via willowapi and saves it as png through mullvad.

        quality: "2k" ($0.005) or "4k" ($0.010). use 4k only for hero art.
        out_path: where to write the png, relative to the repo root.
        returns a status line with file size and cost.
        """
        try:
            return generate(prompt, quality, out_path, exits=exits)
        except GenerationError as err:
            raise RuntimeError(str(err)) from None

    server.run()


def main() -> int:
    _load_env()
    parser = argparse.ArgumentParser(description="willow image generation through mullvad")
    parser.add_argument("--prompt")
    parser.add_argument("--quality", default="2k", choices=["2k", "4k"])
    parser.add_argument("--out", default="image.png")
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument(
        "--direct",
        action="store_true",
        help="use the current mullvad tunnel instead of a relay socks endpoint",
    )
    parser.add_argument(
        "--mullvad-exit",
        action="append",
        help="mullvad wireguard relay name from `mullvad relay list`; repeat to rotate",
    )
    args = parser.parse_args()

    if args.direct and args.mullvad_exit:
        parser.error("--direct cannot be combined with --mullvad-exit")

    exits = tuple(args.mullvad_exit) if args.mullvad_exit else None
    if args.prompt:
        try:
            print(generate(args.prompt, args.quality, args.out, args.model, exits, args.direct))
        except GenerationError as err:
            print(f"error: {err}", file=sys.stderr)
            return 1
        return 0

    run_mcp(exits)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
