from api._lib import abuse


def test_email_fingerprint_is_normalized_and_stable(monkeypatch):
    monkeypatch.setattr(abuse.config, "SUPABASE_SERVICE_ROLE_KEY", "test-secret")

    assert abuse.email_fingerprint(" User@Example.com ") == abuse.email_fingerprint(
        "user@example.com"
    )


def test_email_fingerprint_does_not_expose_email(monkeypatch):
    monkeypatch.setattr(abuse.config, "SUPABASE_SERVICE_ROLE_KEY", "test-secret")

    fingerprint = abuse.email_fingerprint("user@example.com")

    assert fingerprint != "user@example.com"
    assert len(fingerprint) == 64


def test_email_fingerprint_is_keyed(monkeypatch):
    monkeypatch.setattr(abuse.config, "SUPABASE_SERVICE_ROLE_KEY", "first-secret")
    first = abuse.email_fingerprint("user@example.com")
    monkeypatch.setattr(abuse.config, "SUPABASE_SERVICE_ROLE_KEY", "second-secret")

    assert abuse.email_fingerprint("user@example.com") != first
