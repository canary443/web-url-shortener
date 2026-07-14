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
WILLOW_API_KEY = os.environ.get("WILLOW_API_KEY", "")
SITE_URL = os.environ.get("NEXT_PUBLIC_SITE_URL", "http://localhost:3000")

# anonymous links live one hour
ANON_LINK_TTL_SECONDS = 3600

# shorten limits per hour
ANON_SHORTEN_PER_HOUR = 10
USER_SHORTEN_PER_HOUR = 60

# chat limits per hour
ANON_CHAT_PER_HOUR = 10
USER_CHAT_PER_HOUR = 50
