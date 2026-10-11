"""Festival sources, civil dates, artwork identities and public-holiday scope."""

import json
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = json.loads((ROOT / "public/data/holidays.json").read_text(encoding="utf-8"))


def test_festival_occurrences_are_year_specific_and_source_backed() -> None:
    rows = DATA["festival_calendar"]
    assert rows
    assert len({row["id"] for row in rows}) == len(rows)
    for row in rows:
        assert 1900 <= date.fromisoformat(row["date"]).year <= 2100
        assert row["festival_id"] in DATA["festival_art"]
        assert row["type"] == "religious_festival"
        assert row["status"] == "official"
        assert row["scope"] and date.fromisoformat(row["reviewed"])
        assert row["source"].startswith("https://")
        assert row["provenance"]["review_decision"] in {
            "approved",
            "automatically_validated",
        }
    for identity, _year, day in [
        ("diwali", 2026, "2026-11-08"),
        ("diwali", 2027, "2027-10-29"),
        ("holi", 2026, "2026-03-04"),
        ("holi", 2027, "2027-03-23"),
    ]:
        assert any(
            row["festival_id"] == identity and row["date"] == day for row in rows
        )


def test_every_festival_record_has_reusable_artwork() -> None:
    assert len(DATA["festival_art"]) == 34
    images = set()
    for key, festival in DATA["festival_art"].items():
        assert festival["image"] == f"/art/festivals/{key}.webp"
        assert (ROOT / "public" / festival["image"].lstrip("/")).is_file()
        images.add(festival["image"])
    assert len(images) == 34
    for row in DATA["records"]:
        if row["festival"]:
            assert row["festival_id"] in DATA["festival_art"]


def test_unreviewed_future_dates_and_state_closures_are_not_invented() -> None:
    approved = json.loads(
        (ROOT / "data/holidays/approved.json").read_text(encoding="utf-8")
    )
    automatic = json.loads(
        (ROOT / "data/holidays/automatic.json").read_text(encoding="utf-8")
    )
    supported = {
        row["id"]
        for row in [
            *approved["records"],
            *approved["festival_calendar"],
            *automatic["records"],
        ]
    }
    assert all(
        row["id"] in supported for row in [*DATA["records"], *DATA["festival_calendar"]]
    )
    assert all(row["type"] != "state_public" for row in DATA["festival_calendar"])
