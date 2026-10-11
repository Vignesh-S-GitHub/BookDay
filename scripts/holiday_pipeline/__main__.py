"""CLI: python -m scripts.holiday_pipeline --help."""

import argparse
import hashlib
import json
import logging
from datetime import UTC, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from .adapters import parse
from .automatic import synchronize
from .fetch import fetch
from .india_post import synchronize as synchronize_post
from .publish import publish
from .report import conflicts
from .storage import DATA, ROOT, changes, digest, read, source_changes, validate, write


def inspect() -> dict:
    registry = read(DATA / "sources.json")
    approved = read(DATA / "approved.json")
    return {
        "sources": registry["sources"],
        "reviewed_records": len(approved["records"]),
        "reviewed_observances": len(approved["festival_calendar"]),
        "coverage": read(DATA / "coverage.json")
        if (DATA / "coverage.json").exists()
        else "Run publish",
    }


def check(
    state: str | None, year: int | None, source_id: str | None, work: Path
) -> dict:
    sources = read(DATA / "sources.json")["sources"]
    reports = []
    approved = read(DATA / "approved.json")
    for source in sources:
        if (
            state
            and source["jurisdiction"] != state
            or year
            and source.get("year") != year
            or source_id
            and source["id"] != source_id
        ):
            continue
        if not source.get("url") or source.get("collection") != "public-notice":
            reports.append(
                {
                    "source_id": source["id"],
                    "status": "pending",
                    "reason": "No tested ingestion adapter / annual document",
                }
            )
            continue
        try:
            content, metadata = fetch(source, work / "cache")
            if source["adapter"] != "tn-gazette-v1":
                reports.append(
                    {
                        "source_id": source["id"],
                        "status": "changed" if metadata["changed"] else "unchanged",
                        "metadata": metadata,
                        "review": "Manual table review required; no candidate records extracted by unsupported adapter.",
                    }
                )
                continue
            rows = parse(content, source)
            existing = [
                r for r in approved["records"] if r.get("source_id") == source["id"]
            ]
            candidate = {
                "source": source,
                "metadata": metadata,
                "records": rows,
                "review": "pending",
                "diff": source_changes(existing, rows),
            }
            candidate["conflicts"] = conflicts(
                [r for r in approved["records"] if r.get("source_id") != source["id"]]
                + rows
            )
            candidate["candidate_hash"] = digest(
                {"source": source, "metadata": metadata, "records": rows}
            )
            write(work / "candidates" / f"{source['id']}.json", candidate)
            reports.append(
                {
                    "source_id": source["id"],
                    "status": "changed" if metadata["changed"] else "unchanged",
                    "rows": len(rows),
                    "candidate_hash": candidate["candidate_hash"],
                    "diff": candidate["diff"],
                    "conflicts": candidate["conflicts"],
                }
            )
        except (OSError, ValueError, RuntimeError) as exc:
            reports.append(
                {"source_id": source["id"], "status": "failed", "reason": str(exc)}
            )
    if not reports:
        raise ValueError("No registered source matches selection")
    report = {
        "checked": datetime.now(UTC).isoformat(),
        "sources": reports,
        "publishing": "No automatic approval; approved records unchanged.",
    }
    write(work / "report.json", report)
    return report


def approve(
    candidate_path: Path,
    candidate_hash: str,
    reviewer: str,
    reason: str,
    evidence: Path,
    allow_removals: bool = False,
) -> dict:
    candidate = read(candidate_path)
    source = candidate["source"]
    actual_hash = digest({k: candidate[k] for k in ("source", "metadata", "records")})
    if candidate_hash != actual_hash or candidate_hash != candidate["candidate_hash"]:
        raise ValueError("Candidate changed since review")
    evidence_bytes = evidence.read_bytes()
    if hashlib.sha256(evidence_bytes).hexdigest() != candidate["metadata"]["sha256"]:
        raise ValueError("Review PDF does not match fetched document hash")
    if parse(evidence_bytes, source) != candidate["records"]:
        raise ValueError(
            "Candidate rows differ from the source adapter; re-extract and review"
        )
    approved = read(DATA / "approved.json")
    old = [r for r in approved["records"] if r.get("source_id") == source["id"]]
    if old and all(
        r.get("provenance", {}).get("parse_hash") == digest(candidate["records"])
        and r["provenance"].get("document_sha256") == candidate["metadata"]["sha256"]
        for r in old
    ):
        return {
            "approved": source["id"],
            "rows": len(old),
            "changed": False,
            "reason": "This exact source and extraction are already approved.",
        }
    states = read(ROOT / "public/data/catalog.json")["states"]
    now = datetime.now(UTC).isoformat()
    provenance = {
        "source_id": source["id"],
        "authority": source["owner"],
        "issued": source.get("issue_date") or source.get("publication_date"),
        "document_sha256": candidate["metadata"]["sha256"],
        "retrieved": candidate["metadata"]["retrieved"],
        "reviewed_at": now,
        "reviewer": reviewer,
        "review_decision": "approved",
        "reason": reason,
        "candidate_hash": candidate_hash,
    }
    provenance["parse_hash"] = digest(candidate["records"])
    rows = []
    # Attach reviewed festival identity only through explicit mappings, never guessing.
    aliases = read(DATA / "festival-aliases.json")
    for row in candidate["records"]:
        row = {**row, "reviewed": now[:10], "provenance": provenance}
        festival_id = aliases.get(row["name"])
        if festival_id:
            row.update(festival=True, festival_id=festival_id)
        rows.append(row)
    validate(rows, states)
    delta = changes(old, rows)
    if delta["removed"] and not allow_removals:
        raise ValueError("Removal requires explicit --allow-removals review")
    next_rows = [
        r for r in approved["records"] if r.get("source_id") != source["id"]
    ] + rows
    if conflicts(next_rows):
        raise ValueError(
            "Conflicting dates from distinct sources need explicit amendment review before approval"
        )
    validate(next_rows + approved["festival_calendar"], states)
    # A reviewed source cannot silently substitute another document or jurisdiction.
    registered = next(
        (s for s in read(DATA / "sources.json")["sources"] if s["id"] == source["id"]),
        None,
    )
    if registered != source:
        raise ValueError("Candidate source differs from registry")
    history = (
        read(DATA / "history.json")
        if (DATA / "history.json").exists()
        else {"decisions": []}
    )
    approved["records"] = sorted(next_rows, key=lambda r: (r["date"], r["id"]))
    for changed in delta["changed"]:
        if changed["old"]["date"] != changed["new"]["date"]:
            approved.setdefault("changes", []).append(
                {
                    "id": changed["id"],
                    "name": changed["new"]["name"],
                    "old_date": changed["old"]["date"],
                    "new_date": changed["new"]["date"],
                    "jurisdictions": changed["new"]["jurisdictions"],
                    "reason": reason,
                    "reviewed": now[:10],
                    "source": source["url"],
                }
            )
    schedule = {
        "year": source["year"],
        "jurisdiction": source["jurisdiction"],
        "category": "public",
        "sufficient": True,
        "scope": "Complete published annual state-government schedule only; later/local amendments require separate review.",
        "source_ids": [source["id"]],
    }
    approved["schedules"] = [
        s
        for s in approved.get("schedules", [])
        if (s["year"], s["jurisdiction"], s["category"])
        != (source["year"], source["jurisdiction"], "public")
    ] + [schedule]
    history["decisions"].append(
        {**provenance, "diff": delta, "publication_version": digest(approved)[:20]}
    )
    write(DATA / "history.json", history)
    write(DATA / "approved.json", approved)
    archive = (
        DATA
        / "documents"
        / f"{source['id']}-{candidate['metadata']['sha256'][:16]}.pdf"
    )
    archive.parent.mkdir(parents=True, exist_ok=True)
    archive.write_bytes(evidence_bytes)
    registry = read(DATA / "sources.json")
    for entry in registry["sources"]:
        if entry["id"] == source["id"]:
            entry.update(
                retrieval_date=provenance["retrieved"],
                checksum=provenance["document_sha256"],
                last_successful_check=provenance["retrieved"],
                etag=candidate["metadata"].get("etag"),
                last_modified=candidate["metadata"].get("last_modified"),
            )
    write(DATA / "sources.json", registry)
    return {
        "approved": source["id"],
        "rows": len(rows),
        "diff": delta,
        "publish": "Run publish after reviewing the git diff.",
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("inspect")
    sub.add_parser("publish")
    sub.add_parser("validate")
    automatic_parser = sub.add_parser("sync")
    automatic_parser.add_argument("--from-year", type=int, default=2024)
    automatic_parser.add_argument("--through-year", type=int)
    automatic_parser.add_argument(
        "--work", type=Path, default=ROOT / "output/holiday-pipeline"
    )
    for command in ["check", "backfill"]:
        p = sub.add_parser(command)
        p.add_argument("--state")
        p.add_argument("--year", type=int)
        p.add_argument("--source")
        p.add_argument("--work", type=Path, default=ROOT / "output/holiday-pipeline")
    p = sub.add_parser("approve")
    p.add_argument("candidate", type=Path)
    p.add_argument("--hash", required=True)
    p.add_argument("--reviewer", required=True)
    p.add_argument("--reason", required=True)
    p.add_argument("--evidence", type=Path, required=True)
    p.add_argument("--allow-removals", action="store_true")
    args = parser.parse_args()
    if args.command == "inspect":
        result = inspect()
    elif args.command == "publish":
        result = publish()
    elif args.command == "sync":
        logging.basicConfig(level=logging.INFO, format="%(message)s")
        through = args.through_year or datetime.now(ZoneInfo("Asia/Kolkata")).year + 1
        if through < args.from_year or through - args.from_year > 100:
            raise ValueError("Invalid backfill year range")
        report = synchronize(list(range(args.from_year, through + 1)), args.work)
        postal_report = synchronize_post(
            list(range(args.from_year, through + 1)), args.work
        )
        manifest = publish()
        result = {
            "changed": report["changed"],
            "records": report["records"],
            "version": manifest["version"],
            "updated_regions": sum(s["status"] == "updated" for s in report["sources"]),
            "retained_regions": sum(
                s["status"] == "retained" for s in report["sources"]
            ),
            "report": str(args.work / "automatic-report.json"),
            "india_post_changed": postal_report["changed"],
        }
    elif args.command == "validate":
        data = read(DATA / "approved.json")
        automatic = (
            read(DATA / "automatic.json")
            if (DATA / "automatic.json").exists()
            else {"records": []}
        )
        validate(
            data["records"] + data["festival_calendar"] + automatic["records"],
            read(ROOT / "public/data/catalog.json")["states"],
        )
        result = {"valid": True}
    elif args.command == "approve":
        result = approve(
            args.candidate,
            args.hash,
            args.reviewer,
            args.reason,
            args.evidence,
            args.allow_removals,
        )
    else:
        result = check(args.state, args.year, args.source, args.work)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
