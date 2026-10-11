"""Framework independent date rules. All opening dates use India local time."""

from calendar import monthrange
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from typing import Literal

IST = timezone(timedelta(hours=5, minutes=30), "Asia/Kolkata")
Mode = Literal["days", "months", "fixed", "weekly", "monthly", "unknown", "tatkal"]


@dataclass(frozen=True)
class Rule:
    mode: Mode
    amount: int = 60
    opening_time: time | None = None
    fixed_date: date | None = None
    origin_date: date | None = None
    train_class: Literal["ac", "non-ac"] = "ac"
    verified: bool = False


def subtract_months(value: date, months: int) -> date:
    total = value.year * 12 + value.month - 1 - months
    year, month = divmod(total, 12)
    month += 1
    if not 1900 <= year <= 2100:
        raise ValueError("Calculated date must be between 1900 and 2100.")
    return date(year, month, min(value.day, monthrange(year, month)[1]))


def calculate(
    event: date, rule: Rule, now: datetime | None = None
) -> dict[str, str | bool | None]:
    if not 1900 <= event.year <= 2100:
        raise ValueError("Event year must be between 1900 and 2100.")
    if not 0 <= rule.amount <= 3650:
        raise ValueError("Rule amount must be between 0 and 3650.")
    opening_time = rule.opening_time
    if rule.mode == "unknown":
        return {
            "opening_date": None,
            "opening_time": None,
            "opening_at": None,
            "event_date": event.isoformat(),
            "status": "Not Announced",
            "rule": "Opening date not announced",
            "verified": False,
        }
    if rule.mode == "days":
        opening = event - timedelta(days=rule.amount)
        label = f"{rule.amount} days before the event (excluding event date)"
    elif rule.mode == "months":
        opening = subtract_months(event, rule.amount)
        label = f"{rule.amount} calendar months before; clip to last valid day"
    elif rule.mode == "fixed":
        if not rule.fixed_date:
            raise ValueError("Enter the announced opening date.")
        opening = rule.fixed_date
        label = "User supplied announced date"
    elif rule.mode == "tatkal":
        if not rule.origin_date:
            raise ValueError(
                "Tatkal needs the train departure date from its originating station."
            )
        if rule.origin_date > event:
            raise ValueError("Origin departure cannot be after your boarding date.")
        opening = rule.origin_date - timedelta(days=1)
        opening_time = time(10 if rule.train_class == "ac" else 11)
        label = f"Tatkal: one day before origin departure, {'AC 10:00' if rule.train_class == 'ac' else 'non-AC 11:00'} IST"
    elif rule.mode == "weekly":
        if not 0 <= rule.amount <= 6:
            raise ValueError("Choose a weekday from Monday (0) through Sunday (6).")
        opening = event - timedelta(days=(event.weekday() - rule.amount) % 7)
        label = "Latest selected weekday on or before the event"
    elif rule.mode == "monthly":
        if not 1 <= rule.amount <= 31:
            raise ValueError("Monthly day must be between 1 and 31.")
        opening = event.replace(
            day=min(rule.amount, monthrange(event.year, event.month)[1])
        )
        if opening > event:
            previous = subtract_months(event.replace(day=1), 1)
            opening = previous.replace(
                day=min(rule.amount, monthrange(previous.year, previous.month)[1])
            )
        label = "Latest selected day of month on or before the event; clip to month end"
    else:
        raise ValueError("Unknown rule mode.")
    if not 1900 <= opening.year <= 2100:
        raise ValueError("Calculated date must be between 1900 and 2100.")
    current = now or datetime.now(IST)
    if current.tzinfo is None:
        raise ValueError("Current time must include a timezone.")
    current = current.astimezone(IST)
    at = datetime.combine(opening, opening_time, IST) if opening_time else None
    status = "Upcoming"
    if opening < current.date() or (at and at < current):
        status = "Already Opened"
    elif opening == current.date():
        status = "Opens Today"
    return {
        "opening_date": opening.isoformat(),
        "opening_time": opening_time.isoformat(timespec="minutes")
        if opening_time
        else None,
        "opening_at": at.isoformat() if at else None,
        "event_date": event.isoformat(),
        "status": status,
        "rule": label,
        "verified": rule.verified,
        "verification_status": "Verified policy"
        if rule.verified
        else "Rule Unverified",
    }
