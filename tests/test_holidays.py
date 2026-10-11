import json
from datetime import date
from pathlib import Path

from bookday.holidays import Holiday, applicable, demand_signal, long_weekends


def holiday(
    day: str, state: str = "IN", kind: str = "national_public", status: str = "official"
) -> Holiday:
    return {
        "date": day,
        "name": "Example",
        "jurisdictions": [state],
        "type": kind,
        "status": status,
        "source": "https://example.gov.in",
    }


def test_jurisdiction() -> None:
    rows = [holiday("2026-01-26"), holiday("2026-04-15", "Kerala")]
    assert len(applicable(rows, "Tamil Nadu")) == 1
    assert len(applicable(rows, "Kerala")) == 2


def test_tamil_nadu_official_annual_schedule() -> None:
    data = json.loads(
        (Path(__file__).resolve().parents[1] / "public/data/holidays.json").read_text(
            encoding="utf-8"
        )
    )
    rows = applicable(data["records"], "Tamil Nadu")
    rows = [row for row in rows if row["date"].startswith("2026")]
    assert len(rows) == 25
    by_name = {row["name"]: row for row in rows}
    assert by_name["Pongal"]["date"] == "2026-01-15"
    assert by_name["Ayutha Pooja"]["date"] == "2026-10-19"
    assert by_name["Deepavali"]["date"] == "2026-11-08"
    assert by_name["Tamil Nadu Assembly polling day"]["date"] == "2026-04-23"
    assert by_name["Bank annual closing"]["type"] == "bank_holiday"
    assert "721_Ex_II_1_2025.pdf" in by_name["Pongal"]["source"]
    assert len({row["id"] for row in data["records"]}) == len(data["records"])


def test_long_weekends_ignore_bank_festival_and_unverified() -> None:
    rows = [
        holiday("2026-01-26"),
        holiday("2026-10-02"),
        holiday("2026-12-25", kind="bank_holiday"),
        holiday("2026-09-04", kind="religious_festival"),
        holiday("2026-07-03", status="tentative"),
    ]
    blocks = long_weekends(rows, "Tamil Nadu")
    assert blocks == [
        [date(2026, 1, 24), date(2026, 1, 25), date(2026, 1, 26)],
        [date(2026, 10, 2), date(2026, 10, 3), date(2026, 10, 4)],
    ]


def test_demand_is_explained_and_missing_is_unknown() -> None:
    rows = [holiday("2026-04-15", "Kerala")]
    assert demand_signal(rows, "Kerala", date(2026, 4, 15)) == ("High", ["Example"])
    assert demand_signal(rows, "Tamil Nadu", date(2026, 4, 15)) == (
        "Insufficient data",
        [],
    )
    assert demand_signal(rows, "Tamil Nadu", date(2026, 4, 18)) == (
        "Moderate",
        ["Weekend"],
    )
