# central place for env access
# vercel provides env vars directly, locally we read .env with a tiny loader
import os
from pathlib import Path


def _load_dotenv() -> None:
    env_path = Path(__file__).resolve().parents[2] / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip())


_load_dotenv()

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
SITE_URL = os.environ.get("NEXT_PUBLIC_SITE_URL", "http://localhost:3000")

# link lifetimes
ANON_LINK_TTL_SECONDS = 3600
USER_LINK_TTL_SECONDS = 31 * 24 * 3600

# shorten limits: anon per hour, accounts per minute (marketed as 5 rpm)
ANON_SHORTEN_PER_HOUR = 10
USER_SHORTEN_PER_MINUTE = 5

# api callers may choose their own link expiry within these bounds
MIN_EXPIRES_IN_SECONDS = 60
MAX_EXPIRES_IN_SECONDS = 3 * 3600

# authenticated api calls (list, delete) per hour
USER_API_PER_HOUR = 240
