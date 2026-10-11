"""Annual cache and India Post official-source behavior."""

import copy
from datetime import UTC, datetime, timedelta

import pytest

from scripts.holiday_pipeline import annual_cache, automatic, india_post
from scripts.holiday_pipeline.storage import DATA, ROOT, read, validate, write
from tests.test_automatic_holidays import raw, response


def test_cache_year_checksum_and_refresh_policy(tmp_path) -> None:
    path = tmp_path / "annual.json"
    annual_cache.save(path, 2026, india_post.SOURCE, [{"date": "2026-01-01"}])
    value = annual_cache.load(path, 2026, india_post.SOURCE)
    assert value and annual_cache.fresh(value)
    assert annual_cache.load(path, 2027, india_post.SOURCE) is None
    now = datetime(2026, 10, 11, tzinfo=UTC)
    value["checked"] = (now - timedelta(days=8)).isoformat()
    assert not annual_cache.fresh(value, now)
    value["year"] = 2025
    assert annual_cache.fresh(value, now)
    value["rows"][0]["date"] = "2027-01-01"
    write(path, value)
    assert annual_cache.load(path, 2025, india_post.SOURCE) is None
    write(path, [])
    assert annual_cache.load(path, 2026, india_post.SOURCE) is None


def test_portal_cache_prevents_repeated_network_calls(tmp_path) -> None:
    write(tmp_path / "festival-aliases.json", read(DATA / "festival-aliases.json"))
    calls = []

    def fetch(year, page, central):
        calls.append((year, central))
        return response([raw()])

    automatic.synchronize([2026], tmp_path / "work", tmp_path, fetch)
    first = read(tmp_path / "automatic.json")
    assert len(calls) == 2
    automatic.synchronize([2026], tmp_path / "work", tmp_path, fetch)
    assert len(calls) == 2
    assert read(tmp_path / "automatic.json") == first


def test_post_bundle_is_data_only_and_year_specific() -> None:
    content = 'JSON.parse(\'{"All India":[{"name":"Christmas Day","date":"25-December-2026","day":"Friday"}]}\')'
    assert list(india_post.parse_bundle(content)) == [2026]
    with pytest.raises(ValueError):
        india_post.parse_bundle("JSON.parse(alert('unsafe'))")
    with pytest.raises(ValueError, match="Mixed years"):
        india_post.parse_bundle(content.replace("]}", ',{"date":"25-December-2025"}]}'))


def test_post_circles_never_claim_state_public_leave() -> None:
    rows = [{"name": "Christmas Day", "date": "25-December-2026", "day": "Friday"}]
    parsed = india_post.circle_rows(
        rows, 2026, "Tamil Nadu", read(DATA / "festival-aliases.json")
    )
    assert parsed[0]["type"] == "religious_festival"
    assert parsed[0]["scope"] == "postal_observance"
    assert parsed[0]["jurisdictions"] == ["Tamil Nadu"]
    with pytest.raises(ValueError, match="mismatch"):
        india_post.circle_rows(rows, 2027, "Tamil Nadu", {})
    states = read(ROOT / "public/data/catalog.json")["states"]
    assert india_post.circle_state("West Bengal Circle (Sikkim)", states) == "Sikkim"
    assert (
        india_post.circle_state("West Bengal Circle (Andaman and Nicobar)", states)
        == "Andaman and Nicobar Islands"
    )
    assert india_post.circle_state("Unknown Circle", states) is None


def test_portal_dates_win_over_conflicting_postal_guides() -> None:
    portal = automatic.parse_row(raw(), 2026, "Tamil Nadu", {})
    assert portal
    postal = india_post.circle_rows(
        [{"name": "New Year's Day", "date": "01-January-2026", "day": "Thursday"}],
        2026,
        "Tamil Nadu",
        {},
    )[0]
    postal["date"] = "2026-01-02"
    public, guide = automatic.merge_records(
        {"records": [], "festival_calendar": []},
        {"records": [postal, portal]},
    )
    assert public == [portal]
    assert guide == []


def test_post_nested_circle_cache_is_idempotent(tmp_path) -> None:
    write(tmp_path / "festival-aliases.json", read(DATA / "festival-aliases.json"))
    row = {"name": "Christmas Day", "date": "25-December-2025", "day": "Thursday"}
    feed = {
        2025: {
            "West Bengal Circle": [row],
            "West Bengal Circle (Andaman and Nicobar)": [row],
        }
    }
    india_post.synchronize([2025], tmp_path / "work", tmp_path, lambda: feed)
    snapshot = read(tmp_path / "automatic.json")
    report = india_post.synchronize([2025], tmp_path / "work", tmp_path, lambda: feed)
    assert not report["changed"]
    assert read(tmp_path / "automatic.json") == snapshot
    assert {row["jurisdictions"][0] for row in snapshot["records"]} == {
        "West Bengal",
        "Andaman and Nicobar Islands",
    }


def test_post_cached_and_unavailable_years_retain_data(tmp_path) -> None:
    write(tmp_path / "festival-aliases.json", read(DATA / "festival-aliases.json"))
    calls = []

    def fetch():
        calls.append(True)
        return {
            2026: {
                "All India": [
                    {
                        "name": "Christmas Day",
                        "date": "25-December-2026",
                        "day": "Friday",
                    }
                ]
            }
        }

    india_post.synchronize([2026], tmp_path / "work", tmp_path, fetch)
    snapshot = read(tmp_path / "automatic.json")
    validate(snapshot["records"], read(ROOT / "public/data/catalog.json")["states"])
    india_post.synchronize([2026], tmp_path / "work", tmp_path, fetch)
    assert len(calls) == 1
    report = india_post.synchronize([2027], tmp_path / "work", tmp_path, lambda: {})
    assert report["years"][0]["status"] == "retained"
    assert read(tmp_path / "automatic.json") == snapshot
    forged = copy.deepcopy(snapshot["records"])
    forged[0]["type"] = "state_public"
    with pytest.raises(ValueError, match="provenance"):
        validate(forged, ["Tamil Nadu"])
