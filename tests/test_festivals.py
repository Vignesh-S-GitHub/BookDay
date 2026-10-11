"""Festival sources, civil dates, artwork identities and public-holiday scope."""

import json
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = json.loads((ROOT / "public/data/holidays.json").read_text(encoding="utf-8"))


def test_festival_occurrences_are_year_specific_and_source_backed() -> None:
    rows = DATA["festival_calendar"]
    assert len(rows) == 65
    assert len({row["id"] for row in rows}) == len(rows)
    for row in rows:
        assert date.fromisoformat(row["date"]).year in {2026, 2027}
        assert row["festival_id"] in DATA["festival_art"]
        assert row["type"] == "religious_festival"
        assert row["status"] == "official"
        assert row["scope"] and row["reviewed"] == "2026-10-11"
        assert row["source"].startswith("https://")
        if row["date"].startswith("2027"):
            assert row["source"].endswith("list_holidays_2027.pdf")
    by_id = {row["id"]: row for row in rows}
    assert by_id["festival-2026-diwali"]["date"] == "2026-11-08"
    assert by_id["festival-2027-diwali"]["date"] == "2027-10-29"
    assert by_id["festival-2026-holi"]["date"] == "2026-03-04"
    assert by_id["festival-2027-holi"]["date"] == "2027-03-23"


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
    assert not any(row["date"].startswith("2028") for row in DATA["festival_calendar"])
    assert not any(
        row["date"].startswith("2027")
        and row["festival_id"] in {"thai_poosam", "vishu", "karkadaka_vavu"}
        for row in DATA["festival_calendar"]
    )
    assert (
        len([row for row in DATA["records"] if row["date"][:4] in {"2026", "2027"}])
        == 45
    )
    assert not any(
        row["type"] == "state_public" and row["date"].startswith("2027")
        for row in DATA["records"]
    )
