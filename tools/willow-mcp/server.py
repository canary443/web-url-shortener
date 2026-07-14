# willow-image mcp server
# generates images through willowapi.digital (openai-compatible images api)
# two modes:
#   mcp stdio server (default): registered in .mcp.json, exposes generate_image
#   cli mode: python tools/willow-mcp/server.py --prompt "..." --quality 2k --out banner.png
import argparse
import base64
import json
import os
import sys
import time
from pathlib import Path

import httpx

WILLOW_BASE = "https://willowapi.digital/v1"
DEFAULT_MODEL = "gpt-image-1"
PRICES = {"2k": 0.005, "4k": 0.010}
SIZES = {"2k": "2048x2048", "4k": "4096x4096"}

# the upstream rate limiter is aggressive, retry with long pauses
MAX_ATTEMPTS = 4
RETRY_WAIT_SECONDS = 65


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
    key = os.environ.get("WILLOW_IMAGE_API_KEY") or os.environ.get("WILLOW_API_KEY")
    if not key:
        raise RuntimeError("WILLOW_IMAGE_API_KEY is not set, add it to .env")
    return key


def generate(prompt: str, quality: str, out_path: str, model: str = DEFAULT_MODEL) -> str:
    if quality not in PRICES:
        raise ValueError("quality must be 2k or 4k")

    payload = {
        "model": model,
        "prompt": prompt,
        "size": SIZES[quality],
        "n": 1,
    }
    headers = {"Authorization": f"Bearer {_api_key()}"}

    last_error = ""
    for attempt in range(1, MAX_ATTEMPTS + 1):
        if attempt > 1:
            time.sleep(RETRY_WAIT_SECONDS)
        try:
            resp = httpx.post(
                f"{WILLOW_BASE}/images/generations",
                json=payload,
                headers=headers,
                timeout=300,
            )
        except httpx.HTTPError as err:
            last_error = f"network error: {err}"
            continue

        if resp.status_code == 429:
            last_error = "rate limited by willowapi"
            continue
        if resp.status_code != 200:
            # a 4xx about size or model is worth surfacing immediately
            return f"error {resp.status_code}: {resp.text[:400]}"

        data = resp.json()["data"][0]
        raw: bytes
        if data.get("b64_json"):
            raw = base64.b64decode(data["b64_json"])
        elif data.get("url"):
            raw = httpx.get(data["url"], timeout=120).content
        else:
            return f"error: unexpected response shape: {json.dumps(data)[:300]}"

        out = Path(out_path)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_bytes(raw)
        return (
            f"saved {out} ({len(raw) // 1024} kb, {quality}, "
            f"cost ${PRICES[quality]:.3f})"
        )

    return f"error: gave up after {MAX_ATTEMPTS} attempts, last: {last_error}"


def run_mcp() -> None:
    from mcp.server.fastmcp import FastMCP

    server = FastMCP("willow-image")

    @server.tool()
    def generate_image(prompt: str, quality: str = "2k", out_path: str = "image.png") -> str:
        """generates an image via willowapi gpt image and saves it as png.

        quality: "2k" ($0.005) or "4k" ($0.010). use 4k only for hero art.
        out_path: where to write the png, relative to the repo root.
        returns a status line with file size and cost, or an error line.
        """
        return generate(prompt, quality, out_path)

    server.run()


def main() -> None:
    _load_env()
    parser = argparse.ArgumentParser(description="willow image generation")
    parser.add_argument("--prompt")
    parser.add_argument("--quality", default="2k", choices=["2k", "4k"])
    parser.add_argument("--out", default="image.png")
    parser.add_argument("--model", default=DEFAULT_MODEL)
    args = parser.parse_args()

    if args.prompt:
        print(generate(args.prompt, args.quality, args.out, args.model))
        sys.exit(0)

    run_mcp()


if __name__ == "__main__":
    main()
