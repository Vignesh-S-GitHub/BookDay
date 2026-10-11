"""Only approved, validated records are emitted as cacheable static datasets."""

from .automatic import merge_records
from .storage import DATA, ROOT, digest, read, slug, validate, write

CATEGORIES = ["public", "bank", "festival", "education", "district"]


def coverage(rows: list[dict], schedules: list[dict], states: list[str]) -> list[dict]:
    years = sorted({2024, 2025, 2026, 2027, *(int(r["date"][:4]) for r in rows)})
    report = []
    for year in years:
        for state in ["IN", *states]:
            local = [
                r
                for r in rows
                if r["date"].startswith(str(year)) and state in r["jurisdictions"]
            ]
            for category in CATEGORIES:
                count = sum(
                    (
                        r["type"] in {"state_public", "national_public"}
                        if category == "public"
                        else r["type"] == "bank_holiday"
                        if category == "bank"
                        else bool(r.get("festival"))
                        if category == "festival"
                        else r["type"] == "school_holiday"
                        if category == "education"
                        else bool(r.get("district"))
                    )
                    for r in local
                )
                schedule = next(
                    (
                        s
                        for s in schedules
                        if s["year"] == year
                        and s["jurisdiction"] == state
                        and s["category"] == category
                    ),
                    None,
                )
                status = (
                    "complete"
                    if schedule and schedule["sufficient"]
                    else "partial"
                    if count
                    else "not_verified"
                )
                report.append(
                    {
                        "year": year,
                        "jurisdiction": state,
                        "category": category,
                        "status": status,
                        "count": count,
                        "scope": schedule["scope"]
                        if schedule
                        else "Only published records; annual source sufficiency not established.",
                        "source_ids": schedule["source_ids"] if schedule else [],
                    }
                )
    return report


def publish(data=DATA, output=None) -> dict:
    output = output or ROOT / "public/data"
    approved = read(data / "approved.json")
    automatic = (
        read(data / "automatic.json") if (data / "automatic.json").exists() else {}
    )
    approved["records"], approved["festival_calendar"] = merge_records(
        approved, automatic
    )
    approved["festival_calendar"] = [
        {
            **row,
            "source_title": row["name"],
            "name": approved["festival_art"][row["festival_id"]]["name"],
        }
        if row.get("provenance", {}).get("review_decision") == "automatically_validated"
        else row
        for row in approved["festival_calendar"]
    ]
    catalog = read(ROOT / "public/data/catalog.json")
    rows = approved["records"] + approved["festival_calendar"]
    public_ids = {row["id"] for row in approved["records"]}
    validate(rows, catalog["states"])
    report = coverage(rows, approved.get("schedules", []), catalog["states"])
    festival_regions_by_year = {
        state: {
            str(year): sorted(
                {
                    row["festival_id"]
                    for row in approved["records"]
                    if row.get("festival_id")
                    and row.get("festival")
                    and row["status"] == "official"
                    and state in row["jurisdictions"]
                    and row["date"].startswith(str(year))
                }
            )
            for year in sorted(
                {
                    int(row["date"][:4])
                    for row in approved["records"]
                    if state in row["jurisdictions"]
                }
            )
        }
        for state in catalog["states"]
    }
    festival_regions = {
        state: years[max(years)] if years else []
        for state, years in festival_regions_by_year.items()
    }
    version = digest({"approved": approved, "publication_schema": 2})[:20]
    # Content-addressed datasets prevent a cached manifest mixing old/new releases.
    entries = {}
    for year in sorted({int(r["date"][:4]) for r in rows}):
        for state in ["IN", *catalog["states"]]:
            selected = [
                r
                for r in rows
                if r["date"].startswith(str(year)) and state in r["jurisdictions"]
            ]
            if not selected:
                continue
            payload = {
                "version": version,
                "year": year,
                "jurisdiction": state,
                "records": [r for r in selected if r["id"] in public_ids],
                "festival_calendar": [r for r in selected if r["id"] not in public_ids],
            }
            checksum = digest(payload)
            filename = f"{year}/{'national' if state == 'IN' else slug(state)}-{checksum[:16]}.json"
            write(output / "holidays" / filename, payload)
            entries[f"{year}:{state}"] = {
                "url": "/data/holidays/" + filename,
                "checksum": checksum,
                "count": len(selected),
                "version": version,
            }
    manifest = {
        "version": version,
        "schema": 2,
        "datasets": entries,
        "coverage": report,
        "festival_art": approved["festival_art"],
        "festival_regions": festival_regions,
        "festival_regions_by_year": festival_regions_by_year,
        "changes": approved.get("changes", []),
        "automatic_updates": {
            "enabled": True,
            "source": "https://www.india.gov.in/calendar",
            "updated": automatic.get("updated"),
        },
        "scope": "Annual source coverage is category- and jurisdiction-specific. Complete annual schedules do not imply all later notices or private-employer leave. Missing data is not zero holidays.",
    }
    write(output / "holidays/manifest.json", manifest)
    # Transitional compatibility export keeps existing consumers and artwork paths.
    write(
        output / "holidays.json",
        {
            **approved,
            "version": 2,
            "publication_version": version,
            "festival_regions": festival_regions,
            "festival_regions_by_year": festival_regions_by_year,
        },
    )
    write(data / "coverage.json", {"version": version, "rows": report})
    return manifest
