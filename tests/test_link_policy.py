from datetime import datetime, timedelta, timezone

from api._lib import config, link_policy


NOW = datetime(2026, 7, 14, 7, 0, tzinfo=timezone.utc)


def test_anonymous_link_expires_after_one_hour():
    expiry = datetime.fromisoformat(link_policy.expires_at(False, NOW))
    assert expiry - NOW == timedelta(seconds=config.ANON_LINK_TTL_SECONDS)


def test_authenticated_link_expires_after_31_days():
    expiry = datetime.fromisoformat(link_policy.expires_at(True, NOW))
    assert expiry - NOW == timedelta(seconds=config.USER_LINK_TTL_SECONDS)
    assert expiry - NOW == timedelta(days=31)


def test_only_authenticated_links_collect_clicks():
    assert link_policy.collects_clicks("user-id") is True
    assert link_policy.collects_clicks(None) is False


def test_api_override_wins_over_default_ttl():
    expiry = datetime.fromisoformat(link_policy.expires_at(True, NOW, override_seconds=1800))
    assert expiry - NOW == timedelta(seconds=1800)


def test_api_override_bounds_are_configured():
    assert config.MIN_EXPIRES_IN_SECONDS == 60
    assert config.MAX_EXPIRES_IN_SECONDS == 3 * 3600
    assert config.USER_SHORTEN_PER_MINUTE == 5
