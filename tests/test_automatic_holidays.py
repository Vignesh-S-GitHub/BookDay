"""Automatic collection, source validation and unattended publication regressions."""

import copy
from datetime import date

import pytest

from scripts.holiday_pipeline import automatic
from scripts.holiday_pipeline.publish import publish
from scripts.holiday_pipeline.storage import DATA, ROOT, read, validate, write


def raw(year: int = 2026, *, state: str = "tamil-nadu", identity: int = 1) -> dict:
    value = date(year, 1, 1)
    return {
        "id": identity,
        "attributes": {
            "title": "New Year’s Day",
            "date": value.isoformat(),
            "year": str(year),
            "day": value.strftime("%A"),
            "holiday_type": "Gazetted",
            "publishedAt": "2026-01-01T00:00:00Z",
            "updatedAt": "2026-01-01T00:00:00Z",
            "state_dept_org": {"data": {"attributes": {"alias": state}}},
        },
    }


def response(
    rows: list[dict], page: int = 1, pages: int = 1, total: int | None = None
) -> dict:
    return {
        "data": {
            "data": rows,
            "meta": {
                "pagination": {
                    "page": page,
                    "pageCount": pages if rows else 0,
                    "total": len(rows) if total is None else total,
                }
            },
        }
    }


def directory(tmp_path):
    for filename in ["approved.json", "festival-aliases.json"]:
        write(tmp_path / filename, read(DATA / filename))
    return tmp_path


def test_all_36_states_have_exact_portal_aliases() -> None:
    states = read(ROOT / "public/data/catalog.json")["states"]
    assert len({automatic.state_alias(state) for state in states}) == 36
    assert automatic.state_alias("Delhi") == "delhi-nct"
    assert automatic.state_alias("Ladakh") == "ladakh-ut"


def test_pagination_is_complete_stable_and_unique(monkeypatch) -> None:
    monkeypatch.setattr(automatic, "PAGE_SIZE", 2)
    rows = [raw(identity=n) for n in [1, 2, 3]]

    def fetch(year, page, central):
        return response(rows[:2] if page == 1 else rows[2:], page, 2, 3)

    assert automatic.annual_feed(2026, fetch) == rows
    with pytest.raises(ValueError, match="Wrong page"):
        automatic.annual_feed(2026, lambda *args: response(rows[:2], 2, 2, 3))
    with pytest.raises(ValueError, match="Incomplete"):
        automatic.annual_feed(2026, lambda *args: response(rows[:1], 1, 2, 3))
    with pytest.raises(ValueError, match="duplicate"):
        automatic.annual_feed(
            2026,
            lambda year, page, central: response(
                rows[:2] if page == 1 else rows[:1], page, 2, 3
            ),
        )


@pytest.mark.parametrize(
    "field,value",
    [
        ("day", "Sunday"),
        ("date", "2025-01-01"),
        ("year", "2027"),
        ("publishedAt", None),
        ("holiday_type", "Unknown"),
        ("title", "<script>"),
    ],
)
def test_invalid_official_rows_are_rejected(field, value) -> None:
    row = raw()
    row["attributes"][field] = value
    with pytest.raises(ValueError):
        automatic.parse_row(row, 2026, "Tamil Nadu", {})


def test_restricted_state_holidays_never_become_general_leave() -> None:
    row = raw()
    row["attributes"]["holiday_type"] = "Restricted"
    assert automatic.parse_row(row, 2026, "Tamil Nadu", {}) is None
    row["attributes"]["title"] = "Diwali (Deepavali)"
    central = automatic.parse_row(row, 2026, "IN", {})
    assert central is not None
    assert central["type"] == "religious_festival"
    assert central["festival_id"] == "diwali"
    row["attributes"]["title"] = "Republic Day"
    assert automatic.parse_row(row, 2026, "IN", {}) is None
    row["attributes"].update(holiday_type="Gazetted", date="2026-01-26", day="Monday")
    national = automatic.parse_row(row, 2026, "IN", {})
    assert national is not None and national["type"] == "national_public"


def test_restricted_errors_do_not_reject_valid_public_calendar() -> None:
    restricted = raw(identity=2)
    restricted["attributes"].update(holiday_type="Restricted", day="Wrong weekday")
    grouped, failures = automatic.collect_year(
        [raw(), restricted], 2026, ["Tamil Nadu"], {}
    )
    assert not failures and len(grouped["Tamil Nadu"]) == 1


def test_all_states_are_collected_independently_and_missing_years_stay_empty(
    tmp_path, monkeypatch
) -> None:
    states = read(ROOT / "public/data/catalog.json")["states"]
    calls = []

    def fetcher(year, page, central=False, alias=None):
        calls.append((year, alias))
        return response([raw(year, state=alias)] if year == 2026 and alias else [])

    monkeypatch.setattr(automatic, "fetch_page", fetcher)
    data = directory(tmp_path / "data")
    result = automatic.synchronize([2026, 2027], tmp_path / "work", data, fetcher)
    rows = read(data / "automatic.json")["records"]
    assert len(rows) == 36
    assert {row["jurisdictions"][0] for row in rows} == set(states)
    assert all(row["date"].startswith("2026") for row in rows)
    assert len(calls) == 74 and len(result["sources"]) == 74


def test_region_specific_days_and_multiple_dates_are_preserved() -> None:
    row = automatic.parse_row(raw(state="puducherry-ut"), 2026, "Puducherry", {})
    assert row is not None and row["district"] and "Mahe" in row["note"]
    first = {
        "id": "one",
        "name": "Onam",
        "date": "2026-08-25",
        "jurisdictions": ["Kerala"],
        "type": "state_public",
    }
    second = {**first, "id": "two", "date": "2026-08-26"}
    public, _ = automatic.merge_records(
        {"records": [], "festival_calendar": []}, {"records": [first, second]}
    )
    assert public == [first, second]


def test_national_dates_are_not_duplicated_in_each_state() -> None:
    central = {
        "id": "national",
        "name": "Republic Day",
        "date": "2026-01-26",
        "jurisdictions": ["IN"],
        "type": "national_public",
    }
    local = {**central, "id": "local", "jurisdictions": ["Tamil Nadu"]}
    public, _ = automatic.merge_records(
        {"records": [central], "festival_calendar": []}, {"records": [local]}
    )
    assert public == [central]


def test_live_snapshot_covers_every_configured_state() -> None:
    states = read(ROOT / "public/data/catalog.json")["states"]
    snapshot = read(DATA / "automatic.json")
    rows = [row for row in snapshot["records"] if row["date"].startswith("2026")]
    assert set(states) <= {row["jurisdictions"][0] for row in rows}
    validate(rows, states)


def test_synchronization_needs_no_review_and_is_idempotent(tmp_path) -> None:
    data = directory(tmp_path / "data")

    def fetcher(year, page, central):
        return response([] if central else [raw(year)])

    first = automatic.synchronize([2026, 2027], tmp_path / "work", data, fetcher)
    assert first["changed"]
    snapshot = read(data / "automatic.json")
    assert len(snapshot["records"]) == 2
    assert all(
        r["provenance"]["review_decision"] == "automatically_validated"
        for r in snapshot["records"]
    )
    assert not automatic.synchronize([2026, 2027], tmp_path / "work", data, fetcher)[
        "changed"
    ]
    assert read(data / "automatic.json") == snapshot
    manifest = publish(data, tmp_path / "published")
    assert "2027:Tamil Nadu" in manifest["datasets"]
    assert manifest["automatic_updates"]["enabled"]


def test_unavailable_empty_and_malformed_sources_preserve_last_data(tmp_path) -> None:
    data = directory(tmp_path / "data")
    automatic.synchronize(
        [2026],
        tmp_path / "work",
        data,
        lambda year, page, central: response([] if central else [raw()]),
    )
    original = read(data / "automatic.json")

    def unavailable(*args):
        raise OSError("Source unavailable")

    for fetcher in [
        unavailable,
        lambda *args: response([]),
        lambda *args: {"invalid": True},
    ]:
        result = automatic.synchronize([2026], tmp_path / "work", data, fetcher)
        assert not result["changed"]
        assert read(data / "automatic.json") == original
    invalid = raw()
    invalid["attributes"]["day"] = "Wrong weekday"
    automatic.synchronize(
        [2026], tmp_path / "work", data, lambda *args: response([invalid])
    )
    assert read(data / "automatic.json") == original


def test_automatic_provenance_cannot_be_added_to_arbitrary_sources(tmp_path) -> None:
    data = directory(tmp_path / "data")
    automatic.synchronize(
        [2026],
        tmp_path / "work",
        data,
        lambda year, page, central: response([] if central else [raw()]),
    )
    row = read(data / "automatic.json")["records"][0]
    row["source"] = "https://example.com/holidays"
    with pytest.raises(ValueError, match="provenance"):
        validate([row], ["Tamil Nadu"])


def test_changed_dates_replace_same_named_day_without_duplicates() -> None:
    old = {
        "id": "old",
        "name": "Diwali",
        "date": "2026-11-08",
        "type": "state_public",
        "jurisdictions": ["Goa"],
    }
    latest = {**old, "id": "live", "date": "2026-11-09"}
    baseline = {"records": [copy.deepcopy(old)], "festival_calendar": []}
    records, guide = automatic.merge_records(baseline, {"records": [latest]})
    assert records == [latest] and guide == []
    assert baseline["records"] == [old]


def test_workflow_publishes_daily_without_an_approval_or_cloudflare_secret() -> None:
    workflow = (ROOT / ".github/workflows/holiday-sources.yml").read_text()
    assert "cron:" in workflow and "contents: write" in workflow
    assert "holiday_pipeline sync" in workflow
    assert "holiday_pipeline.release publish" in workflow
    assert "environment:" not in workflow and "CLOUDFLARE_API_TOKEN" not in workflow
