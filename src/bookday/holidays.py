"""Source-aware calendar helpers; holidays never imply employer leave."""

from datetime import date, timedelta
from typing import TypedDict


class Holiday(TypedDict):
    date: str
    name: str
    jurisdictions: list[str]
    type: str
    status: str
    source: str


def applicable(records: list[Holiday], state: str) -> list[Holiday]:
    return [
        row
        for row in records
        if "IN" in row["jurisdictions"] or state in row["jurisdictions"]
    ]


def long_weekends(records: list[Holiday], state: str) -> list[list[date]]:
    days = {
        date.fromisoformat(row["date"])
        for row in applicable(records, state)
        if row["status"] == "official"
        and row["type"] in {"national_public", "state_public"}
    }
    blocks: set[tuple[date, ...]] = set()
    for day in days:
        start = end = day
        while (
            start - timedelta(days=1) in days
            or (start - timedelta(days=1)).weekday() >= 5
        ):
            start -= timedelta(days=1)
        while (
            end + timedelta(days=1) in days or (end + timedelta(days=1)).weekday() >= 5
        ):
            end += timedelta(days=1)
        block = tuple(start + timedelta(days=i) for i in range((end - start).days + 1))
        if len(block) >= 3 and any(value.weekday() >= 5 for value in block):
            blocks.add(block)
    return [list(block) for block in sorted(blocks)]


def demand_signal(
    records: list[Holiday], state: str, day: date
) -> tuple[str, list[str]]:
    nearby = [
        row
        for row in applicable(records, state)
        if row["status"] == "official"
        and row["type"] != "bank_holiday"
        and abs((date.fromisoformat(row["date"]) - day).days) <= 1
    ]
    reasons = [row["name"] for row in nearby]
    if day.weekday() >= 5:
        reasons.append("Weekend")
    return (
        "High" if nearby else "Moderate" if reasons else "Insufficient data",
        reasons,
    )
