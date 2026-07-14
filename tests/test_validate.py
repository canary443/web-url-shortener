from api._lib import config, validate


def test_plain_https_url_passes():
    assert validate.clean_url("https://example.com/page") == "https://example.com/page"


def test_http_allowed():
    assert validate.clean_url("http://example.com") == "http://example.com"


def test_bare_domain_gets_https():
    assert validate.clean_url("example.com/x") == "https://example.com/x"


def test_javascript_scheme_rejected():
    assert validate.clean_url("javascript:alert(1)") is None


def test_data_scheme_rejected():
    assert validate.clean_url("data:text/html,hi") is None


def test_ftp_rejected():
    assert validate.clean_url("ftp://example.com") is None


def test_localhost_rejected():
    assert validate.clean_url("http://localhost:8000/admin") is None


def test_private_ips_rejected():
    assert validate.clean_url("http://127.0.0.1/") is None
    assert validate.clean_url("http://192.168.1.1/") is None
    assert validate.clean_url("http://10.0.0.5/x") is None


def test_dot_local_rejected():
    assert validate.clean_url("http://printer.local") is None


def test_host_without_dot_rejected():
    assert validate.clean_url("https://intranet") is None


def test_too_long_rejected():
    assert validate.clean_url("https://example.com/" + "a" * 3000) is None


def test_own_site_rejected(monkeypatch):
    monkeypatch.setattr(config, "SITE_URL", "https://short.vercel.app")
    assert validate.clean_url("https://short.vercel.app/abc") is None


def test_empty_rejected():
    assert validate.clean_url("   ") is None
