# decides when an anonymous shorten looks automated and deserves a captcha.
# datacenter detection uses the packed ranges module, burst detection reuses
# the db rate limit counters. everything here fails open: a broken heuristic
# must never lock humans out
import base64
import bisect
import ipaddress
import struct
import zlib

from . import config, ratelimit


def _unpack(blob: str, width: int) -> tuple[list[int], list[int]]:
    raw = zlib.decompress(base64.b85decode(blob))
    step = width * 2
    starts, ends = [], []
    for offset in range(0, len(raw), step):
        starts.append(int.from_bytes(raw[offset : offset + width], "big"))
        ends.append(int.from_bytes(raw[offset + width : offset + step], "big"))
    return starts, ends


try:
    from . import dc_ranges

    _V4_STARTS, _V4_ENDS = _unpack(dc_ranges.V4, 4)
    _V6_STARTS, _V6_ENDS = _unpack(dc_ranges.V6, 16)
except Exception:
    # missing or corrupt data module disables the check, not the service
    _V4_STARTS, _V4_ENDS = [], []
    _V6_STARTS, _V6_ENDS = [], []

# aws prefix pairs come pre-sorted, but bisect needs it guaranteed
if _V4_STARTS != sorted(_V4_STARTS):
    _V4_ENDS = [e for _, e in sorted(zip(_V4_STARTS, _V4_ENDS))]
    _V4_STARTS = sorted(_V4_STARTS)
if _V6_STARTS != sorted(_V6_STARTS):
    _V6_ENDS = [e for _, e in sorted(zip(_V6_STARTS, _V6_ENDS))]
    _V6_STARTS = sorted(_V6_STARTS)


def is_datacenter(ip: str) -> bool:
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return False
    value = int(addr)
    starts, ends = (
        (_V4_STARTS, _V4_ENDS) if addr.version == 4 else (_V6_STARTS, _V6_ENDS)
    )
    i = bisect.bisect_right(starts, value) - 1
    return i >= 0 and ends[i] >= value


def suspicion(ip: str) -> str | None:
    # every anon attempt feeds the counters, so a flood keeps the captcha
    # requirement alive until the burst actually stops
    if is_datacenter(ip):
        return "datacenter ip"
    if not ratelimit.allow_read(
        "global", "anon_shorten_burst", config.ANON_BURST_PER_MINUTE, 60
    ):
        return "burst"
    if not ratelimit.allow_read(ip, "anon_shorten_fast", config.ANON_FAST_PER_15S, 15):
        return "burst"
    return None
