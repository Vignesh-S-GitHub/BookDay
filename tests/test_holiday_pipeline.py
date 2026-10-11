"""Offline source fixtures, safe publication and candidate review regressions."""

import hashlib
from datetime import date
from email.message import Message
from urllib import error

import pytest

from scripts.holiday_pipeline import __main__ as cli
from scripts.holiday_pipeline.adapters import parse, tamil_nadu
from scripts.holiday_pipeline.fetch import fetch
from scripts.holiday_pipeline.publish import coverage, publish
from scripts.holiday_pipeline.report import conflicts
from scripts.holiday_pipeline.storage import (
    DATA,
    ROOT,
    changes,
    digest,
    read,
    source_changes,
    validate,
    write,
)


def source(year: int = 2024) -> dict:
    return {
        "id": f"tn-{year}-annual",
        "year": year,
        "expected_rows": 2,
        "url": "https://example.gov.in/notice.pdf",
        "jurisdiction": "Tamil Nadu",
        "owner": "Government",
        "adapter": "tn-gazette-v1",
        "collection": "public-notice",
    }


def test_explicit_adapter_leap_year_and_wrapped_cells() -> None:
    text = "Public Holidays\n1. New Year's Day 01.01.2024 Monday\n2. *Annual closing of Accounts 01.04.2024 Monday\nfor Commercial Banks & Co-operative Banks"
    rows = tamil_nadu(text, source())
    assert len(rows) == 2
    assert rows[1]["type"] == "bank_holiday"
    assert rows[1]["reviewed"] is None
    with pytest.raises(ValueError, match="Weekday"):
        tamil_nadu(text.replace("Monday", "Sunday", 1), source())
    with pytest.raises(ValueError, match="Wrong year"):
        tamil_nadu(text, source(2025))
    with pytest.raises(ValueError):
        tamil_nadu("scanned notice with no text table", source())
    with pytest.raises(ValueError, match="sequential"):
        tamil_nadu(text.replace("2.", "3."), source())
    assert date.fromisoformat("2024-02-29")
    with pytest.raises(ValueError):
        date.fromisoformat("2025-02-29")


def test_real_year_specific_backfill_fixtures() -> None:
    approved = read(DATA / "approved.json")
    for year, pongal, diwali in [
        (2024, "2024-01-15", "2024-10-31"),
        (2025, "2025-01-14", "2025-10-20"),
    ]:
        rows = [
            r for r in approved["records"] if r.get("source_id") == f"tn-{year}-annual"
        ]
        assert len(rows) == 24
        assert next(r for r in rows if r["name"] == "Pongal")["date"] == pongal
        assert next(r for r in rows if r["name"] == "Deepavali")["date"] == diwali
        assert sum(r["type"] == "bank_holiday" for r in rows) == 1
        for row in rows:
            path = next((DATA / "documents").glob(f"tn-{year}-annual-*.pdf"))
            assert (
                hashlib.sha256(path.read_bytes()).hexdigest()
                == row["provenance"]["document_sha256"]
            )
            assert row["provenance"]["review_decision"] == "approved"


def test_validation_preserves_mixed_jurisdictions_and_provisional_scope() -> None:
    data = read(DATA / "approved.json")
    row = {
        **data["records"][0],
        "status": "tentative",
        "jurisdictions": ["Tamil Nadu", "Kerala"],
    }
    validate([row], ["Tamil Nadu", "Kerala"])
    with pytest.raises(ValueError, match="Duplicate"):
        validate([row, row], ["Tamil Nadu", "Kerala"])
    with pytest.raises(ValueError, match="Unknown"):
        validate([{**row, "jurisdictions": ["Invented State"]}], ["Tamil Nadu"])
    with pytest.raises(ValueError, match="approved"):
        validate(
            [{**row, "provenance": {"review_decision": "pending"}}],
            ["Tamil Nadu", "Kerala"],
        )


def test_coverage_counts_do_not_imply_source_sufficiency() -> None:
    data = read(DATA / "approved.json")
    report = coverage(
        data["records"] + data["festival_calendar"],
        data["schedules"],
        ["Tamil Nadu", "Kerala", "Goa"],
    )

    def cell(state, year, category):
        return next(
            r
            for r in report
            if (r["jurisdiction"], r["year"], r["category"]) == (state, year, category)
        )

    assert cell("Tamil Nadu", 2024, "public")["status"] == "complete"
    assert cell("Kerala", 2026, "public")["status"] == "partial"
    assert cell("Goa", 2026, "public")["status"] == "not_verified"
    assert cell("Tamil Nadu", 2027, "public")["status"] == "not_verified"
    assert cell("Tamil Nadu", 2025, "bank")["status"] == "partial"
    assert cell("Goa", 2026, "festival")["status"] == "not_verified"


def test_publication_is_deterministic_and_checksum_addressed(tmp_path) -> None:
    first = publish(output=tmp_path)
    second = publish(output=tmp_path)
    assert first == second
    assert "2025:Tamil Nadu" in first["datasets"]
    assert "2026:Goa" not in first["datasets"]
    for entry in first["datasets"].values():
        payload = read(tmp_path / entry["url"].removeprefix("/data/"))
        assert digest(payload) == entry["checksum"]
    assert len(read(tmp_path / "holidays.json")["records"]) == 93
    approved = read(DATA / "approved.json")
    public_ids = {row["id"] for row in approved["records"]}
    for entry in first["datasets"].values():
        payload = read(tmp_path / entry["url"].removeprefix("/data/"))
        assert all(row["id"] in public_ids for row in payload["records"])
        assert all(row["id"] not in public_ids for row in payload["festival_calendar"])
        expected = {
            row["id"]
            for row in approved["records"]
            if row["date"].startswith(str(payload["year"]))
            and payload["jurisdiction"] in row["jurisdictions"]
        }
        assert {row["id"] for row in payload["records"]} == expected


def test_change_diff_keeps_old_and_new_dates() -> None:
    old = {"id": "stable", "date": "2026-03-21"}
    new = {"id": "stable", "date": "2026-03-22"}
    delta = changes([old], [new])
    assert delta["changed"][0] == {"id": "stable", "old": old, "new": new}
    assert changes([old], [])["removed"] == [old]
    assert not changes([old], [old])["changed"]
    assert not source_changes(
        [{**old, "reviewed": "2026-10-11", "provenance": {"reviewer": "known"}}], [old]
    )["changed"]


class Response:
    def __init__(self, body, headers=None):
        self.body = body
        self.headers = headers or {}

    def read(self, size):
        return self.body[:size]

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


def test_conditional_fetch_failure_never_deletes_cached_source(tmp_path) -> None:
    calls = []

    def opener(req, timeout):
        calls.append(req)
        if req.full_url.endswith("robots.txt"):
            return Response(b"User-agent: *\nAllow: /")
        if req.get_header("If-none-match"):
            raise error.HTTPError(req.full_url, 304, "Unchanged", Message(), None)
        return Response(b"%PDF fixture", {"ETag": '"version-1"'})

    body, meta = fetch(source(), tmp_path, opener, lambda n: None)
    again, current = fetch(source(), tmp_path, opener, lambda n: None)
    assert body == again
    assert current["changed"] is False
    assert meta["sha256"] == hashlib.sha256(body).hexdigest()

    def broken(req, timeout):
        raise error.URLError("Unavailable")

    with pytest.raises(error.URLError):
        fetch(source(), tmp_path, broken, lambda n: None)
    assert (tmp_path / "tn-2024-annual.bin").read_bytes() == body

    def denied(req, timeout):
        return Response(b"User-agent: *\nDisallow: /")

    with pytest.raises(ValueError, match="disallows"):
        fetch(source(), tmp_path, denied, lambda n: None)


def test_approval_requires_exact_reviewed_hash_and_evidence(
    tmp_path, monkeypatch
) -> None:
    directory = tmp_path / "review"
    directory.mkdir()
    baseline = read(DATA / "approved.json")
    write(directory / "approved.json", baseline)
    write(directory / "sources.json", {"sources": [source()]})
    write(directory / "festival-aliases.json", {})
    monkeypatch.setattr(cli, "DATA", directory)
    document = tmp_path / "notice.pdf"
    document.write_bytes(b"%PDF reviewed fixture")
    row = {
        **baseline["records"][0],
        "id": "new-review",
        "source_id": source()["id"],
        "date": "2024-01-01",
    }
    candidate = {
        "source": source(),
        "records": [row],
        "metadata": {
            "sha256": hashlib.sha256(document.read_bytes()).hexdigest(),
            "retrieved": "2026-10-11",
        },
    }
    candidate["candidate_hash"] = digest(candidate)
    path = tmp_path / "candidate.json"
    write(path, candidate)
    with pytest.raises(ValueError, match="changed"):
        cli.approve(path, "wrong", "reviewer", "reason", document)
    wrong = tmp_path / "wrong.pdf"
    wrong.write_bytes(b"different source")
    with pytest.raises(ValueError, match="match"):
        cli.approve(path, candidate["candidate_hash"], "reviewer", "reason", wrong)
    assert read(directory / "approved.json") == baseline


def test_registry_lists_every_jurisdiction_without_fabricating_sources() -> None:
    sources = read(DATA / "sources.json")["sources"]
    states = read(ROOT / "public/data/catalog.json")["states"]
    assert set(states) <= {s["jurisdiction"] for s in sources}
    for s in sources:
        if s["adapter"] == "pending" and s["id"] != "rbi-regional":
            assert s["url"] is None
    assert read(ROOT / "public/data/holidays/manifest.json")["coverage"]


@pytest.mark.parametrize("year", [2024, 2025])
def test_archived_pdf_adapter_without_network(year: int) -> None:
    registry = read(DATA / "sources.json")
    original = next(s for s in registry["sources"] if s["id"] == f"tn-{year}-annual")
    path = next((DATA / "documents").glob(f"tn-{year}-annual-*.pdf"))
    rows = parse(path.read_bytes(), original)
    assert len(rows) == 24
    assert rows[0]["date"] == f"{year}-01-01"
    assert sum(r["type"] == "bank_holiday" for r in rows) == 1


def test_conflicts_keep_jurisdiction_specific_dates() -> None:
    rows = [
        {
            "id": "1",
            "date": "2026-03-21",
            "name": "Eid",
            "jurisdictions": ["Tamil Nadu"],
            "type": "state_public",
        },
        {
            "id": "2",
            "date": "2026-03-22",
            "name": "Eid",
            "jurisdictions": ["Kerala"],
            "type": "state_public",
        },
    ]
    assert conflicts(rows) == []
    rows[1]["jurisdictions"] = ["Tamil Nadu"]
    assert len(conflicts(rows)) == 1
    assert len(conflicts(rows)[0]["records"]) == 2


def test_idempotent_approved_source_does_not_rewrite_history(
    tmp_path, monkeypatch
) -> None:
    original = next(
        s for s in read(DATA / "sources.json")["sources"] if s["id"] == "tn-2024-annual"
    )
    path = next((DATA / "documents").glob("tn-2024-annual-*.pdf"))
    rows = parse(path.read_bytes(), original)
    candidate = {
        "source": original,
        "metadata": {"sha256": hashlib.sha256(path.read_bytes()).hexdigest()},
        "records": rows,
    }
    candidate["candidate_hash"] = digest(candidate)
    write(tmp_path / "candidate.json", candidate)
    write(tmp_path / "approved.json", read(DATA / "approved.json"))
    monkeypatch.setattr(cli, "DATA", tmp_path)
    before = (tmp_path / "approved.json").read_bytes()
    result = cli.approve(
        tmp_path / "candidate.json",
        candidate["candidate_hash"],
        "reviewer",
        "same notice",
        path,
    )
    assert result["changed"] is False
    assert (tmp_path / "approved.json").read_bytes() == before
    assert not (tmp_path / "history.json").exists()
