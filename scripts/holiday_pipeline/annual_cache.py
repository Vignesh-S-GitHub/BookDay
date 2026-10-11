"""Persistent annual source snapshots; dates are never reused across civil years."""

from datetime import UTC, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

from .storage import digest, read, write


def load(path: Path, year: int, source: str) -> dict | None:
    if not path.exists():
        return None
    try:
        value = read(path)
        if not isinstance(value, dict):
            return None
        if (
            value.get("schema") != 1
            or value.get("year") != year
            or value.get("source") != source
            or value.get("sha256") != digest(value.get("rows"))
            or not value.get("rows")
        ):
            return None
        if datetime.fromisoformat(value["checked"]).tzinfo is None:
            return None
        return value
    except (OSError, ValueError, KeyError, TypeError):
        return None


def fresh(value: dict | None, now: datetime | None = None) -> bool:
    if not value:
        return False
    now = now or datetime.now(UTC)
    current = now.astimezone(ZoneInfo("Asia/Kolkata")).year
    # Historical calendars need only an annual amendment check. Current calendars
    # refresh weekly; next-year announcements are checked daily when available.
    days = 365 if value["year"] < current else 7 if value["year"] == current else 1
    age = now - datetime.fromisoformat(value["checked"])
    return timedelta(0) <= age < timedelta(days=days)


def save(path: Path, year: int, source: str, rows: object) -> None:
    write(
        path,
        {
            "schema": 1,
            "year": year,
            "source": source,
            "checked": datetime.now(UTC).isoformat(),
            "sha256": digest(rows),
            "rows": rows,
        },
    )
