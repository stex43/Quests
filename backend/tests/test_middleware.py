from src.repositories import ArcRepository
from tests.conftest import assert_error_response


def test_disallowed_host_rejected(client):
    resp = client.get("/health", headers={"Host": "evil.example.com"})
    assert_error_response(resp, 400, "invalid_host")


def test_unsafe_method_disallowed_origin_rejected(client):
    resp = client.post("/arcs", json={"title": "Arc"}, headers={"Origin": "http://evil.example.com"})
    assert_error_response(resp, 403, "forbidden_origin")


def test_unsafe_method_same_origin_allowed(client):
    resp = client.post("/arcs", json={"title": "Arc"}, headers={"Origin": "http://localhost"})
    assert resp.status_code == 201


def test_safe_method_any_origin_allowed(client):
    resp = client.get("/health", headers={"Origin": "http://evil.example.com"})
    assert resp.status_code == 200


def test_unhandled_exception_returns_clean_500(client, monkeypatch):
    def fake_get_all(self):
        raise RuntimeError("boom")

    monkeypatch.setattr(ArcRepository, "get_all", fake_get_all)
    resp = client.get("/arcs")
    assert_error_response(resp, 500, "internal_error")
    assert "boom" not in resp.text
    assert "RuntimeError" not in resp.text
    assert "Traceback" not in resp.text
