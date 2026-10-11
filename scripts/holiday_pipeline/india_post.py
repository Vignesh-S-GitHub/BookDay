"""Read India Post's published year/circle lists without executing remote code."""

import json
import logging
import re
from collections import Counter
from datetime import datetime
from urllib import request
from urllib.parse import urljoin

from . import annual_cache
from .automatic import parse_row
from .storage import DATA, ROOT, digest, read, slug, validate, write

SOURCE = "https://www.indiapost.gov.in/holidays-list"
MAX_BODY = 8 * 1024 * 1024


def get(url: str) -> str:
    req = request.Request(url, headers={"User-Agent": "BookDayHolidaySync/2.0"})
    with request.urlopen(req, timeout=20) as response:
        content = response.read(MAX_BODY + 1)
    if len(content) > MAX_BODY:
        raise ValueError("Oversized India Post holiday document")
    return content.decode("utf-8")


def parse_bundle(text: str) -> dict[int, dict]:
    """The official page embeds strict JSON inside JavaScript string literals."""
    result = {}
    for match in re.finditer(r"JSON\.parse\('((?:\\.|[^'\\])*)'\)", text):
        # Decode only string escapes; never eval a downloaded script.
        escapes = {
            "'": "'",
            '"': '"',
            "\\": "\\",
            "n": "\n",
            "r": "\r",
            "t": "\t",
            "/": "/",
        }

        def unescape(value: re.Match, escapes=escapes) -> str:
            code = value[1]
            if code.startswith("u"):
                return chr(int(code[1:], 16))
            if code not in escapes:
                raise ValueError("Unsupported JavaScript string escape")
            return escapes[code]

        literal = re.sub(r"\\(u[0-9a-fA-F]{4}|.)", unescape, match[1])
        value = json.loads(literal)
        if not isinstance(value, dict) or not isinstance(value.get("All India"), list):
            continue
        years = {
            datetime.strptime(row["date"], "%d-%B-%Y").year
            for rows in value.values()
            for row in rows
        }
        if len(years) != 1:
            raise ValueError("Mixed years in India Post annual list")
        year = years.pop()
        if year in result:
            raise ValueError("Duplicate India Post annual list")
        result[year] = value
    if not result:
        raise ValueError("India Post annual JSON layout unavailable")
    return result


def fetch_lists() -> dict[int, dict]:
    page = get(SOURCE)
    paths = re.findall(r'<script[^>]+src="([^"]+)"', page)
    chunks = [
        path for path in paths if "/holidays-list/" in path and path.endswith(".js")
    ]
    if len(chunks) != 1 or not chunks[0].startswith("/_next/static/chunks/"):
        raise ValueError("Unrecognized India Post holiday page layout")
    return parse_bundle(get(urljoin(SOURCE, chunks[0])))


def circle_state(circle: str, states: list[str]) -> str | None:
    if circle == "All India":
        return "IN"
    label = circle.casefold().replace("&", "and")
    if "andaman and nicobar" in label:
        return "Andaman and Nicobar Islands"
    matches = [state for state in states if state.casefold() in label]
    # Nested postal circles explicitly name their local region. Never infer
    # absent UTs from another circle's geography.
    specific = [
        state for state in matches if state in {"Sikkim", "Andaman and Nicobar Islands"}
    ]
    return (
        specific[0] if len(specific) == 1 else matches[0] if len(matches) == 1 else None
    )


def circle_rows(rows: list[dict], year: int, state: str, aliases: dict) -> list[dict]:
    result = []
    seen = set()
    for original in rows:
        day = datetime.strptime(original["date"], "%d-%B-%Y").date()
        if (
            day.year != year
            or original["day"].casefold() != day.strftime("%A").casefold()
        ):
            raise ValueError("India Post date/year/weekday mismatch")
        key = (day.isoformat(), original["name"])
        if key in seen:
            raise ValueError("Duplicate India Post holiday")
        seen.add(key)
        raw = {
            "id": slug(original["name"]),
            "attributes": {
                "title": original["name"],
                "date": day.isoformat(),
                "year": str(year),
                "day": original["day"],
                "holiday_type": "Gazetted",
                "publishedAt": "published",
            },
        }
        row = parse_row(raw, year, "IN", aliases)
        if not row or (row.get("festival") and not row.get("festival_primary")):
            continue
        if state != "IN" and row["type"] == "national_public":
            continue
        source_id = f"india-post-{year}-{slug(state)}"
        row.update(
            {
                "id": f"{source_id}-{day.isoformat()}-{slug(original['name'])}",
                "source_id": source_id,
                "source": SOURCE,
                "jurisdictions": [state],
                "scope": "national"
                if row["type"] == "national_public"
                else "postal_observance",
                "note": "India Post published holiday list; festival observance. Postal-office scope does not establish general state public leave. Lunar dates may be amended.",
            }
        )
        result.append(row)
    return result


def synchronize(years: list[int], work, data=DATA, fetcher=fetch_lists) -> dict:
    states = read(ROOT / "public/data/catalog.json")["states"]
    aliases = read(data / "festival-aliases.json")
    target = data / "automatic.json"
    previous = read(target) if target.exists() else {"schema": 1, "records": []}
    result = {**previous, "records": list(previous["records"])}
    caches = {
        year: annual_cache.load(
            data / "annual-cache" / str(year) / "india-post.json", year, SOURCE
        )
        for year in years
    }
    fetched, error = {}, None
    if any(not annual_cache.fresh(value) for value in caches.values()):
        try:
            fetched = fetcher()
        except (OSError, ValueError, KeyError, TypeError, RuntimeError) as exc:
            error = str(exc)
            logging.getLogger(__name__).warning("India Post unavailable: %s", error)
    reports = []
    for year in years:
        cached = caches[year]
        circles = cached["rows"] if annual_cache.fresh(cached) else fetched.get(year)
        if not circles:
            reports.append(
                {
                    "year": year,
                    "status": "retained",
                    "reason": error or "No published India Post annual list",
                }
            )
            continue
        now = datetime.now().astimezone().isoformat()
        valid_circles = {}
        associations = Counter(circle_state(circle, states) for circle in circles)
        for circle, raw in circles.items():
            state = circle_state(circle, states)
            if not state:
                continue
            try:
                if associations[state] != 1:
                    raise ValueError("Ambiguous duplicate postal-circle association")
                rows = circle_rows(raw, year, state, aliases)
                valid_circles[circle] = raw
                source_id = f"india-post-{year}-{slug(state)}"
                old = [
                    row for row in result["records"] if row["source_id"] == source_id
                ]
                if not rows:
                    continue
                parse_hash = digest(rows)
                if old and old[0]["provenance"]["parse_hash"] == parse_hash:
                    continue
                provenance = {
                    "source_id": source_id,
                    "authority": "Department of Posts, Government of India",
                    "document_sha256": digest(circles),
                    "parse_hash": parse_hash,
                    "retrieved": now,
                    "reviewed_at": now,
                    "reviewer": "BookDay automatic validator",
                    "review_decision": "automatically_validated",
                    "validation_version": 1,
                    "reason": "Official annual postal list; year, date, weekday, circle and festival identity validated.",
                }
                incoming = [
                    {**row, "reviewed": now[:10], "provenance": provenance}
                    for row in rows
                ]
                validate(incoming, states)
                result["records"] = [
                    row for row in result["records"] if row["source_id"] != source_id
                ] + incoming
            except (ValueError, KeyError, TypeError) as exc:
                reports.append(
                    {
                        "year": year,
                        "state": state,
                        "status": "retained",
                        "reason": str(exc),
                    }
                )
        if valid_circles and not annual_cache.fresh(cached):
            annual_cache.save(
                data / "annual-cache" / str(year) / "india-post.json",
                year,
                SOURCE,
                valid_circles,
            )
        reports.append(
            {
                "year": year,
                "status": "cached" if annual_cache.fresh(cached) else "checked",
                "circles": len(circles),
            }
        )
    result["records"].sort(key=lambda row: (row["date"], row["id"]))
    validate(result["records"], states)
    if result != previous:
        result["updated"] = datetime.now().astimezone().isoformat()
        write(target, result)
    report = {"source": SOURCE, "years": reports, "changed": result != previous}
    write(work / "india-post-report.json", report)
    return report
