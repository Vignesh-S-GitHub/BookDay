import subprocess
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

import pytest
from icalendar import Calendar

OUTPUT = Path(__file__).resolve().parents[1] / "output"


@pytest.fixture(scope="module", autouse=True)
def generate_calendar_files() -> None:
    subprocess.run(
        ["node", "--test", "tests/calendar-export.test.js"],
        cwd=OUTPUT.parent,
        check=True,
        capture_output=True,
        text=True,
    )


def test_ics_timed_parser() -> None:
    calendar = Calendar.from_ical((OUTPUT / "timed.ics").read_bytes())
    event = calendar.walk("VEVENT")[0]
    assert event.decoded("dtstart") == datetime(2026, 12, 13, 4, 30, tzinfo=UTC)
    assert event.decoded("dtend") - event.decoded("dtstart") == timedelta(minutes=15)
    assert "சென்னை" in str(event["summary"])
    assert "Chennai, MAS" in str(event["location"])
    assert [alarm.decoded("trigger") for alarm in event.walk("VALARM")] == [
        timedelta(0),
        timedelta(hours=-1),
        timedelta(days=-1),
    ]


def test_ics_all_day_parser() -> None:
    calendar = Calendar.from_ical((OUTPUT / "all-day.ics").read_bytes())
    event = calendar.walk("VEVENT")[0]
    assert event.decoded("dtstart") == date(2026, 12, 31)
    assert event.decoded("dtend") == date(2027, 1, 1)
