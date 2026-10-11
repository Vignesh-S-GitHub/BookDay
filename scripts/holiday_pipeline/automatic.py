"""Automatically collect and validate the NIC National Portal's public calendars."""

import gzip
import json
import logging
import re
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, date, datetime
from pathlib import Path
from urllib import error, request

from . import annual_cache
from .storage import DATA, ROOT, digest, read, slug, validate, write

PORTAL = "https://www.india.gov.in"
ENDPOINT = PORTAL + "/internal/cms"
PAGE_SIZE = 100
MAX_PAGES = 100
MAX_BODY = 8 * 1024 * 1024
STATE_ALIASES = {
    "Andaman and Nicobar Islands": "andaman-and-nicobar-islands-ut",
    "Chandigarh": "chandigarh-ut",
    "Dadra and Nagar Haveli and Daman and Diu": "dadra-and-nagar-haveli-and-daman-and-diu-ut",
    "Delhi": "delhi-nct",
    "Jammu and Kashmir": "jammu-and-kashmir-ut",
    "Ladakh": "ladakh-ut",
    "Lakshadweep": "lakshadweep-ut",
    "Puducherry": "puducherry-ut",
}
NATIONAL = {
    "republic-day",
    "independence-day",
    "mahatma-gandhi-s-birthday",
    "gandhi-jayanti",
    "gandhi-jayanthi",
    "mahatma-gandhi-jayanti",
    "mahatma-gandhi-jayanthi",
}
FESTIVAL_SPELLINGS = {
    "new_year": ["new year s day", "new years day", "new year day"],
    "sankranti": ["makar sankranti", "makara sankranti", "magh bihu"],
    "pongal": ["pongal"],
    "vasant_panchami": ["basant panchami", "vasant panchami", "sri panchami"],
    "thai_poosam": ["thai poosam", "thaipoosam", "thaipusam"],
    "shivratri": ["maha shivaratri", "maha shivratri", "maha sivaratri"],
    "holi": ["holi"],
    "ugadi": ["ugadi", "gudi padwa", "gudi padava", "chaitra sukhladi"],
    "eid_fitr": [
        "id ul fitr",
        "id u l fitr",
        "eid ul fitr",
        "idul fitr",
        "idu l fitr",
        "ramzan",
    ],
    "ram_navami": ["ram navami", "rama navami", "srirama navami", "sri rama navami"],
    "mahavir_jayanti": [
        "mahavir jayanti",
        "mahaveer jayanti",
        "mahavir jayanthi",
        "mahaveer jayanthi",
    ],
    "good_friday": ["good friday"],
    "easter": ["easter"],
    "tamil_new_year": ["tamil new year s day", "tamil new year"],
    "vishu": ["vishu", "visu"],
    "vaisakhi": ["vaisakhi", "baisakhi"],
    "bihu": ["bohag bihu", "bahag bihu", "bihu"],
    "buddha_purnima": ["buddha purnima", "budha purnima", "buddha poornima"],
    "eid_adha": [
        "id ul zuha",
        "idu l zuha",
        "id ul adha",
        "eid ul adha",
        "bakrid",
        "idul azha",
    ],
    "muharram": ["muharram", "moharram", "moharrum"],
    "rath_yatra": ["rath yatra", "ratha yatra"],
    "milad": ["milad un nabi", "id e milad", "eid e milad"],
    "onam": ["onam", "thiruvonam"],
    "raksha_bandhan": ["raksha bandhan", "raksha bandan"],
    "janmashtami": ["janmashtami", "krishna jayanthi", "krishna janmashtami"],
    "ganesh_chaturthi": [
        "ganesh chaturthi",
        "vinayaka chaturthi",
        "vinayakar chathurthi",
        "vinayagar chathurthi",
    ],
    "durga_puja": ["durga puja", "maha ashtami", "mahashtami"],
    "ayutha_pooja": [
        "ayutha pooja",
        "ayudha puja",
        "ayudha pooja",
        "mahanavami",
        "maha navami",
    ],
    "dussehra": [
        "dussehra",
        "vijay dashmi",
        "vijayadashami",
        "vijaya dasami",
        "vijayadasami",
    ],
    "diwali": ["diwali", "deepavali", "dipavali"],
    "chhath": ["chhath puja", "chhat puja", "chhath pooja", "surya shashthi"],
    "gurpurab": [
        "guru nanak s birthday",
        "guru nanak birthday",
        "guru nanak jayanti",
        "guru nanak jayanthi",
    ],
    "christmas": ["christmas day", "christmas"],
}


def state_alias(state: str) -> str:
    return STATE_ALIASES.get(state, slug(state))


def fetch_page(
    year: int, page: int, central: bool = False, alias: str | None = None
) -> dict:
    """Read the exact public JSON route used by the portal calendar UI."""
    collection = "calendar-holidays" if central else "state-holidays"
    route = (
        f"/api/{collection}?populate=*&filters[date][$gte]={year}-01-01"
        f"&filters[date][$lte]={year}-12-31&pagination[pageSize]={PAGE_SIZE}"
        f"&pagination[page]={page}&sort=id"
    )
    if alias:
        route += f"&filters[state_dept_org][alias]={alias}"
    body = json.dumps({"route": route}).encode()
    for attempt in range(3):
        try:
            req = request.Request(
                ENDPOINT,
                data=body,
                headers={
                    "Content-Type": "application/json",
                    "User-Agent": "BookDayHolidaySync/2.0",
                },
                method="POST",
            )
            with request.urlopen(req, timeout=15) as response:
                content = response.read(MAX_BODY + 1)
            if len(content) > MAX_BODY:
                raise ValueError("Oversized holiday feed")
            return json.loads(content)
        except error.HTTPError as exc:
            if exc.code not in {429, 500, 502, 503, 504} or attempt == 2:
                raise
        except (error.URLError, TimeoutError):
            if attempt == 2:
                raise
        time.sleep(2 ** (attempt + 1))
    raise RuntimeError("Holiday feed unavailable")


def annual_feed(
    year: int, fetcher=fetch_page, central: bool = False, alias: str | None = None
) -> list[dict]:
    """Require a complete, stable paginated snapshot before changing any records."""
    rows: list[dict] = []
    expected: tuple[int, int] | None = None
    page_count = 1
    page = 1
    while page <= page_count:
        response = (
            fetcher(year, page, central, alias)
            if alias
            else fetcher(year, page, central)
        )
        if not isinstance(response, dict) or not isinstance(response.get("data"), dict):
            raise ValueError("Invalid annual feed envelope")
        payload = response.get("data", {})
        meta = payload.get("meta")
        if not isinstance(meta, dict) or not isinstance(meta.get("pagination"), dict):
            raise ValueError("Missing pagination metadata")
        pagination = meta["pagination"]
        batch = payload.get("data")
        if not isinstance(batch, list) or any(
            not isinstance(row, dict) for row in batch
        ):
            raise ValueError("Invalid annual feed shape")
        total, count = pagination.get("total"), pagination.get("pageCount")
        if not isinstance(total, int) or not isinstance(count, int):
            raise ValueError("Missing pagination totals")
        if total < 0 or count < 0 or count > MAX_PAGES or total > MAX_PAGES * PAGE_SIZE:
            raise ValueError("Annual feed exceeds bounds")
        if pagination.get("page") != page:
            raise ValueError("Wrong page returned")
        if expected is not None and expected != (total, count):
            raise ValueError("Feed changed during pagination; retry next run")
        expected = (total, count)
        page_count = count
        if len(batch) > PAGE_SIZE or (page < count and len(batch) != PAGE_SIZE):
            raise ValueError("Incomplete annual feed page")
        rows.extend(batch)
        page += 1
    if len(rows) != expected[0] or len({r.get("id") for r in rows}) != len(rows):
        raise ValueError("Incomplete/duplicate annual snapshot")
    return rows


def festival_id(name: str, aliases: dict[str, str]) -> str | None:
    """Explicit spelling aliases only; no inference of festival dates or state leave."""
    normalized = slug(name.replace("\ufffd", "’"))
    exact = {slug(key): value for key, value in aliases.items()}.get(normalized)
    if exact:
        return exact
    words = " " + normalized.replace("-", " ") + " "
    for identity, spellings in FESTIVAL_SPELLINGS.items():
        if any(" " + spelling + " " in words for spelling in spellings):
            return identity
    return None


def parse_row(raw: dict, year: int, state: str, aliases: dict[str, str]) -> dict | None:
    attrs = raw.get("attributes", {})
    if not isinstance(attrs, dict) or not isinstance(raw.get("id"), (int, str)):
        raise ValueError("Invalid holiday attributes or ID")
    if not attrs.get("publishedAt"):
        raise ValueError("Unpublished holiday")
    if not isinstance(attrs.get("holiday_type"), str):
        raise ValueError("Unknown holiday classification")
    kind = attrs["holiday_type"].strip().casefold()
    if kind not in {"gazetted", "restricted"}:
        raise ValueError("Unknown holiday classification")
    if state != "IN" and kind == "restricted":
        return None
    value = attrs.get("date", "")
    day = date.fromisoformat(value)
    if day.year != year or str(attrs.get("year", year)) != str(year):
        raise ValueError("Wrong year in holiday feed")
    if not isinstance(attrs.get("day", ""), str):
        raise ValueError("Invalid weekday")
    weekday = attrs.get("day", "").strip()
    if weekday and weekday.casefold() != day.strftime("%A").casefold():
        raise ValueError("Weekday disagrees with civil date")
    name = " ".join(str(attrs.get("title", "")).replace("\ufffd", "’").split())
    if not name or len(name) > 300 or "<" in name or ">" in name:
        raise ValueError("Invalid holiday title")
    identity = festival_id(name, aliases)
    secondary = bool(
        re.search(
            r"\b(?:eve|saptami|first onam|second onam|third onam|fourth onam|maundy|uzhavar|thiruvalluvar|mattu|kaanum)\b",
            name,
            re.I,
        )
    )
    secondary = secondary or (
        identity == "dussehra"
        and bool(re.search(r"\b(?:ashtami|ashtmi|mahanavami|mahanavmi)\b", name, re.I))
    )
    if state == "IN" and secondary:
        return None  # The illustrated guide shows main festivals, not preceding days.
    national = slug(name) in NATIONAL
    if national:
        if kind != "gazetted":
            return None
        expected_day = (
            (1, 26)
            if slug(name) == "republic-day"
            else (8, 15)
            if slug(name) == "independence-day"
            else (10, 2)
        )
        if (day.month, day.day) != expected_day:
            raise ValueError("National holiday disagrees with fixed civil date")
    if state == "IN" and slug(name) not in NATIONAL and not identity:
        return None
    source_id = f"india-portal-{year}-{'central' if state == 'IN' else slug(state)}"
    source = PORTAL + "/calendar" + ("" if state == "IN" else "/" + state_alias(state))
    bank = bool(
        re.search(r"closing.*(?:account|bank)|(?:account|bank).*closing", name, re.I)
    )
    event_type = (
        "bank_holiday"
        if bank
        else "national_public"
        if national
        else "religious_festival"
        if state == "IN"
        else "state_public"
    )
    return {
        "id": f"{source_id}-{raw['id']}",
        "date": value,
        "name": name,
        "jurisdictions": [state],
        "type": event_type,
        "status": "official",
        "source": source,
        "festival": bool(identity),
        "festival_id": identity,
        "festival_primary": bool(identity) and not secondary,
        "district": "Region-specific; see official notice"
        if state == "Puducherry"
        else None,
        "scope": "bank"
        if bank
        else "national"
        if national
        else "central_observance"
        if state == "IN"
        else "state_government",
        "source_id": source_id,
        "event_key": slug(name),
        "note": "Bank account-closing day; not general public leave."
        if bank
        else "National public holiday; check your employer's working arrangements."
        if national
        else "Official National Portal state calendar; Puducherry/Karaikal, Mahe and Yanam can have different dates. Consult the official notice for your region."
        if state == "Puducherry"
        else "Official National Portal state calendar; government-office scope. Private-employer schedules may differ; lunar dates can be amended."
        if state != "IN"
        else "Official National Portal festival observance; this alone does not establish public leave in every state.",
        "source_record_id": raw["id"],
        "source_updated": attrs.get("updatedAt"),
    }


def collect_year(
    raw_rows: list[dict],
    year: int,
    states: list[str],
    aliases: dict[str, str],
    central: bool = False,
) -> tuple[dict[str, list[dict]], dict[str, str]]:
    mapping = {state_alias(state): state for state in states}
    grouped: dict[str, list[dict]] = {}
    failures: dict[str, str] = {}
    for raw in raw_rows:
        state = "IN"
        if not central:
            attrs = raw.get("attributes")
            if not isinstance(attrs, dict) or not isinstance(
                attrs.get("state_dept_org"), dict
            ):
                raise ValueError("Missing state association")
            parent = attrs["state_dept_org"].get("data") or {}
            if not isinstance(parent, dict) or not isinstance(
                parent.get("attributes"), dict
            ):
                raise ValueError("Invalid state association")
            state = mapping.get(parent.get("attributes", {}).get("alias"), "")
            if not state:
                raise ValueError("Unknown/missing state association in official feed")
        try:
            row = parse_row(raw, year, state, aliases)
            if row is not None:
                grouped.setdefault(state, []).append(row)
        except (ValueError, KeyError, TypeError) as exc:
            failures[state] = str(exc)
    # A malformed state/year never becomes a partially replaced calendar.
    for state in failures:
        grouped.pop(state, None)
    return grouped, failures


def merge_records(approved: dict, automatic: dict) -> tuple[list[dict], list[dict]]:
    """Overlay available automatic calendars while retaining specific local notices."""
    incoming = {}
    for row in automatic.get("records", []):
        if row.get("source_id", "").startswith("india-post-"):
            # State-government/NIC dates take precedence over a postal guide.
            matches = [
                other
                for other in automatic["records"]
                if other.get("source_id", "").startswith("india-portal-")
                and other["jurisdictions"] == row["jurisdictions"]
                and other["date"][:4] == row["date"][:4]
                and (
                    (
                        row.get("festival_id")
                        and row.get("festival_id") == other.get("festival_id")
                    )
                    or (
                        row["type"] == "national_public"
                        and other["type"] == "national_public"
                        and row["date"] == other["date"]
                    )
                )
            ]
            if matches:
                continue
        key = (
            row["date"],
            row["name"].casefold(),
            tuple(row["jurisdictions"]),
            row["type"],
        )
        incoming.setdefault(key, row)
    result = []
    for category in ["records", "festival_calendar"]:
        additions = [
            row
            for row in incoming.values()
            if (row["type"] == "religious_festival")
            == (category == "festival_calendar")
        ]
        retained = []
        for old in approved[category]:
            same = any(
                old["jurisdictions"] == row["jurisdictions"]
                and old["type"] == row["type"]
                and old["date"][:4] == row["date"][:4]
                and (
                    slug(old["name"]) == slug(row["name"])
                    or (
                        old.get("festival_id")
                        and old.get("festival_id") == row.get("festival_id")
                        and (
                            old["date"] == row["date"]
                            or (
                                row.get("festival_primary")
                                and not re.search(
                                    r"\b(?:eve|saptami|first onam|second onam|third onam|fourth onam|maundy|uzhavar|thiruvalluvar|mattu|kaanum)\b",
                                    old["name"],
                                    re.I,
                                )
                            )
                        )
                    )
                    or (
                        old["date"] == row["date"]
                        and old["type"] in {"bank_holiday", "national_public"}
                    )
                )
                for row in additions
            )
            if not same:
                retained.append(old)
        result.append(retained + additions)
    # A nationwide public holiday appears once when a state repeats the same day.
    national_days = {
        row["date"]
        for row in result[0]
        if row["type"] == "national_public" and row["jurisdictions"] == ["IN"]
    }
    result[0] = [
        row
        for row in result[0]
        if not (
            row["date"] in national_days
            and row["type"] == "national_public"
            and row["jurisdictions"] != ["IN"]
        )
    ]
    return result[0], result[1]


def synchronize(
    years: list[int], work: Path, data: Path = DATA, fetcher=fetch_page
) -> dict:
    states = read(ROOT / "public/data/catalog.json")["states"]
    aliases = read(data / "festival-aliases.json")
    path = data / "automatic.json"
    previous = read(path) if path.exists() else {"schema": 1, "records": []}
    result = {**previous, "records": list(previous["records"])}
    reports: list[dict] = []
    now = datetime.now(UTC).isoformat()
    for year in sorted(set(years)):
        if not 1900 <= year <= 2100:
            raise ValueError("Year outside supported range")
        selections = (
            [(False, state_alias(state), state) for state in states]
            + [(True, None, "IN")]
            if fetcher is fetch_page
            else [(False, None, "all states"), (True, None, "IN")]
        )

        def obtain(
            selection: tuple[bool, str | None, str], source_year: int = year
        ) -> list[dict] | Exception:
            central, alias, region = selection
            logging.getLogger(__name__).info("Checking %s %s", source_year, region)
            cache_path = (
                data
                / "annual-cache"
                / str(source_year)
                / f"portal-{alias or ('central' if central else 'states')}.json"
            )
            cached = annual_cache.load(cache_path, source_year, PORTAL + "/calendar")
            if annual_cache.fresh(cached):
                return cached["rows"]
            try:
                return annual_feed(source_year, fetcher, central, alias)
            except (ValueError, KeyError, TypeError, OSError, RuntimeError) as exc:
                return exc

        with ThreadPoolExecutor(max_workers=4) as pool:
            snapshots = list(pool.map(obtain, selections))
        for (central, alias, region), snapshot in zip(
            selections, snapshots, strict=True
        ):
            try:
                if isinstance(snapshot, Exception):
                    raise snapshot
                raw = snapshot
                grouped, failures = collect_year(raw, year, states, aliases, central)
                if alias and any(state != region for state in grouped):
                    raise ValueError("Unexpected state in filtered official response")
                cache_path = (
                    data
                    / "annual-cache"
                    / str(year)
                    / f"portal-{alias or ('central' if central else 'states')}.json"
                )
                cached = annual_cache.load(cache_path, year, PORTAL + "/calendar")
                if grouped and not failures and not annual_cache.fresh(cached):
                    # Strip unrelated CMS metadata; retain every field used by the parser.
                    compact = [
                        {
                            "id": row["id"],
                            "attributes": {
                                key: value
                                for key, value in row["attributes"].items()
                                if key
                                in {
                                    "title",
                                    "date",
                                    "day",
                                    "year",
                                    "holiday_type",
                                    "publishedAt",
                                    "updatedAt",
                                    "state_dept_org",
                                }
                            },
                        }
                        for row in raw
                    ]
                    for row in compact:
                        parent = row["attributes"].get("state_dept_org", {}).get("data")
                        if parent:
                            row["attributes"]["state_dept_org"] = {
                                "data": {
                                    "attributes": {
                                        "alias": parent["attributes"]["alias"]
                                    }
                                }
                            }
                    annual_cache.save(cache_path, year, PORTAL + "/calendar", compact)
                document_hash = digest(raw)
                for state in [region] if alias or central else states:
                    rows = grouped.get(state, [])
                    if state in failures or not rows:
                        reports.append(
                            {
                                "year": year,
                                "state": state,
                                "status": "retained",
                                "reason": failures.get(
                                    state, "No published data available"
                                ),
                            }
                        )
                        continue
                    source_id = rows[0]["source_id"]
                    old = [r for r in result["records"] if r["source_id"] == source_id]
                    parse_hash = digest(rows)
                    if old and old[0]["provenance"]["parse_hash"] == parse_hash:
                        reports.append(
                            {
                                "year": year,
                                "state": state,
                                "status": "unchanged",
                                "rows": len(old),
                            }
                        )
                        continue
                    provenance = {
                        "source_id": source_id,
                        "authority": "National Informatics Centre, National Portal of India",
                        "document_sha256": document_hash,
                        "parse_hash": parse_hash,
                        "retrieved": now,
                        "reviewed_at": now,
                        "reviewer": "BookDay automatic validator",
                        "review_decision": "automatically_validated",
                        "validation_version": 1,
                        "reason": "Published official feed; complete pagination, state association, civil year/date, weekday and classification validated.",
                    }
                    incoming = [
                        {**r, "reviewed": now[:10], "provenance": provenance}
                        for r in rows
                    ]
                    validate(incoming, states)
                    result["records"] = [
                        r for r in result["records"] if r["source_id"] != source_id
                    ] + incoming
                    reports.append(
                        {
                            "year": year,
                            "state": state,
                            "status": "updated",
                            "rows": len(rows),
                        }
                    )
                archive = (
                    work
                    / "evidence"
                    / f"{'central' if central else alias or 'states'}-{year}-{document_hash[:16]}.json.gz"
                )
                archive.parent.mkdir(parents=True, exist_ok=True)
                if not archive.exists():
                    archive.write_bytes(
                        gzip.compress(
                            json.dumps(raw, ensure_ascii=False).encode(), mtime=0
                        )
                    )
            except (ValueError, KeyError, TypeError, OSError, RuntimeError) as exc:
                reports.append(
                    {
                        "year": year,
                        "state": region,
                        "status": "retained",
                        "reason": str(exc),
                    }
                )
    result["records"].sort(key=lambda r: (r["date"], r["id"]))
    validate(result["records"], states)
    changed = result != previous
    if changed:
        result["updated"] = now
        write(path, result)
    report = {
        "checked": now,
        "changed": changed,
        "years": years,
        "sources": reports,
        "records": len(result["records"]),
        "publication": "Automatic validated release; unavailable sources retain previous data.",
    }
    write(work / "automatic-report.json", report)
    return report
