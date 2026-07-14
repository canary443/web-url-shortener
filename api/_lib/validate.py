# target url validation
# we only redirect browsers to these urls, we never fetch them ourselves
import ipaddress
from urllib.parse import urlsplit, urlunsplit

from . import config

MAX_URL_LENGTH = 2048
BLOCKED_HOSTS = {"localhost", "0.0.0.0"}
BLOCKED_SUFFIXES = (".local", ".internal", ".localhost")


def _is_private_ip(host: str) -> bool:
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        return False
    return ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved


def clean_url(raw: str) -> str | None:
    # returns a normalized url, or none when the input is rejected
    url = raw.strip()
    if not url or len(url) > MAX_URL_LENGTH:
        return None

    # bare domains are allowed, https is assumed
    if "://" not in url:
        url = "https://" + url

    try:
        parts = urlsplit(url)
    except ValueError:
        return None

    if parts.scheme not in ("http", "https"):
        return None

    host = (parts.hostname or "").lower()
    if not host or "." not in host and host != "localhost":
        return None
    if host in BLOCKED_HOSTS or host.endswith(BLOCKED_SUFFIXES):
        return None
    if _is_private_ip(host):
        return None

    # no loops through our own domain
    site_host = urlsplit(config.SITE_URL).hostname
    if site_host and host == site_host.lower():
        return None

    return urlunsplit(parts)
