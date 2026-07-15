import hashlib
import hmac

from . import config


def email_fingerprint(email: str) -> str:
    normalized = email.strip().lower().encode()
    secret = config.SUPABASE_SERVICE_ROLE_KEY.encode()
    return hmac.new(secret, normalized, hashlib.sha256).hexdigest()
