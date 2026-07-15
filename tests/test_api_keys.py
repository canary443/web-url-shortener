from api._lib import api_keys


def test_key_hash_is_stable_and_does_not_expose_key():
    raw_key = "lynka_test-key"

    assert api_keys.key_hash(raw_key) == api_keys.key_hash(raw_key)
    assert api_keys.key_hash(raw_key) != raw_key
    assert len(api_keys.key_hash(raw_key)) == 64


def test_generated_key_uses_lynka_prefix(monkeypatch):
    captured = {}

    class Query:
        def upsert(self, data, on_conflict):
            captured.update(data)
            captured["on_conflict"] = on_conflict
            return self

        def execute(self):
            return None

    class FakeClient:
        def table(self, name):
            assert name == "api_keys"
            return Query()

    monkeypatch.setattr(api_keys, "client", FakeClient)
    monkeypatch.setattr(api_keys.secrets, "token_urlsafe", lambda _: "generated")

    raw_key = api_keys.create("user-id")

    assert raw_key == "lynka_generated"
    assert captured["key_hash"] == api_keys.key_hash(raw_key)
    assert captured["key_prefix"] == raw_key[:14]
    assert captured["rpm"] == 5
    assert captured["link_ttl_seconds"] == 31 * 24 * 3600
    assert captured["on_conflict"] == "user_id"
