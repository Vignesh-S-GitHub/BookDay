from datetime import date

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
