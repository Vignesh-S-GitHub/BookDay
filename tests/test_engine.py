from datetime import UTC, date, datetime, time

import pytest

from bookday.engine import IST, Rule, calculate, subtract_months

NOW = datetime(2026, 10, 11, 12, tzinfo=IST)


@pytest.mark.parametrize(
    ("event", "amount", "expected"),
    [
        ("2026-12-15", 60, "2026-10-16"),
        ("2024-03-01", 1, "2024-02-29"),
        ("2025-01-01", 1, "2024-12-31"),
        ("2024-02-29", 60, "2023-12-31"),
        ("2026-10-11", 0, "2026-10-11"),
    ],
)
def test_day_rules(event: str, amount: int, expected: str) -> None:
    result = calculate(date.fromisoformat(event), Rule("days", amount), NOW)
    assert result["opening_date"] == expected


@pytest.mark.parametrize(
    ("day", "months", "expected"),
    [
        ("2024-03-31", 1, "2024-02-29"),
        ("2025-03-31", 1, "2025-02-28"),
        ("2025-01-31", 1, "2024-12-31"),
        ("2024-02-29", 12, "2023-02-28"),
    ],
)
def test_month_clipping(day: str, months: int, expected: str) -> None:
    assert subtract_months(date.fromisoformat(day), months).isoformat() == expected


@pytest.mark.parametrize(
    ("train_class", "expected_time"), [("ac", "10:00"), ("non-ac", "11:00")]
)
def test_tatkal_overnight(train_class: str, expected_time: str) -> None:
    rule = Rule("tatkal", origin_date=date(2026, 12, 14), train_class=train_class)  # ty: ignore[invalid-argument-type]
    result = calculate(date(2026, 12, 15), rule, NOW)
    assert result["opening_date"] == "2026-12-13"
    assert result["opening_time"] == expected_time
    assert str(result["opening_at"]).endswith("+05:30")


def test_tatkal_requires_origin() -> None:
    with pytest.raises(ValueError, match="originating station"):
        calculate(date(2026, 12, 15), Rule("tatkal"), NOW)
    with pytest.raises(ValueError, match="after your boarding"):
        calculate(
            date(2026, 12, 15), Rule("tatkal", origin_date=date(2026, 12, 16)), NOW
        )


def test_fixed_unknown_and_status() -> None:
    assert (
        calculate(date(2026, 12, 15), Rule("unknown"), NOW)["status"] == "Not Announced"
    )
    assert (
        calculate(
            date(2026, 12, 15), Rule("fixed", fixed_date=date(2026, 10, 11)), NOW
        )["status"]
        == "Opens Today"
    )
    assert (
        calculate(
            date(2026, 12, 15),
            Rule("fixed", fixed_date=date(2026, 10, 11), opening_time=time(10)),
            NOW,
        )["status"]
        == "Already Opened"
    )
    assert (
        calculate(
            date(2026, 12, 15),
            Rule("fixed", fixed_date=date(2026, 10, 12), opening_time=time(10)),
            NOW,
        )["status"]
        == "Upcoming"
    )


def test_timezone_crosses_day() -> None:
    now = datetime(2026, 10, 10, 20, tzinfo=UTC)
    assert (
        calculate(date(2026, 10, 11), Rule("days", 0), now)["status"] == "Opens Today"
    )
    with pytest.raises(ValueError, match="timezone"):
        calculate(date(2026, 10, 11), Rule("days", 0), datetime(2026, 10, 11))


def test_recurring_rules() -> None:
    assert (
        calculate(date(2026, 3, 2), Rule("monthly", 31), NOW)["opening_date"]
        == "2026-02-28"
    )
    assert (
        calculate(date(2026, 3, 2), Rule("weekly", 6), NOW)["opening_date"]
        == "2026-03-01"
    )


@pytest.mark.parametrize(
    "rule",
    [
        Rule("days", -1),
        Rule("weekly", 7),
        Rule("monthly", 0),
        Rule("months", 4000),
        Rule("fixed"),
    ],
)
def test_invalid_rules(rule: Rule) -> None:
    with pytest.raises(ValueError):
        calculate(date(2026, 12, 15), rule, NOW)
