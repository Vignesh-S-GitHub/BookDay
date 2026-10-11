import html
import json
import re

from fastapi.testclient import TestClient

from bookday.app import app, templates

client = TestClient(app)


def test_health_and_json() -> None:
    assert client.get("/api/health").json()["timezone"] == "Asia/Kolkata"
    response = client.post(
        "/api/calculate",
        json={
            "event_date": "2026-12-15",
            "mode": "days",
            "amount": 60,
            "category": "trains",
        },
    )
    assert response.status_code == 200
    assert response.json()["opening_date"] == "2026-10-16"
    assert response.json()["verified"] is True
    assert (
        client.post(
            "/api/calculate", json={"event_date": "2026-12-15", "category": "flights"}
        ).json()["verified"]
        is False
    )


def test_invalid_inputs() -> None:
    for payload in [
        {"event_date": "2026-02-30"},
        {"event_date": "2026-12-15", "amount": -1},
        {"event_date": "2200-01-01"},
        {"event_date": "2026-12-15", "mode": "tatkal"},
    ]:
        assert client.post("/api/calculate", json=payload).status_code == 422


def test_bundled_htmx_fragment() -> None:
    response = client.post(
        "/fragments/calculate",
        data={"event_date": "2026-12-15", "amount": "60", "category": "trains"},
    )
    assert response.status_code == 200
    match = re.search("data-result='([^']+)'", response.text)
    assert match is not None
    assert json.loads(html.unescape(match.group(1)))["opening_date"] == "2026-10-16"
    assert (
        client.post("/fragments/calculate", data={"event_date": "bad"}).status_code
        == 422
    )


def test_template_escapes_strings() -> None:
    fragment = templates.get_template("result.html").render(
        result={
            "status": "<script>alert(1)</script>",
            "rule": "<img src=x onerror=alert(1)>",
        }
    )
    assert "<script>" not in fragment
    assert "<img src=x" not in fragment
    assert "&lt;script&gt;" in fragment
