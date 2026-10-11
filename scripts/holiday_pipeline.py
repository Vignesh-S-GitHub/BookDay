"""Validate and publish reviewed BookDay holidays as static, state/year files.

This tool NEVER scrapes arbitrary sites, manufactures dates, or promotes provisional
records to official. Input is the existing human-reviewed v1 holiday dataset.
"""
import argparse
import json
from collections import Counter
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public/data/holidays.json"
CATALOG = ROOT / "public/data/catalog.json"
DEST = ROOT / "public/data/holidays"


def slug(value: str) -> str:
    return "".join(c if c.isalnum() else "-" for c in value.lower()).strip("-").replace("--", "-")


def validate(records: list[dict], states: set[str]) -> None:
    ids: set[str] = set()
    for item in records:
        key = item.get("id")
        if not isinstance(key, str) or not key or key in ids:
            raise ValueError(f"Invalid or duplicate holiday ID: {key!r}")
        ids.add(key)
        try:
            date.fromisoformat(item["date"])
        except (ValueError, TypeError, KeyError) as exc:
            raise ValueError(f"Invalid date for {key}") from exc
        if item.get("status") not in {"official", "provisional", "not_announced"}:
            raise ValueError(f"Invalid status for {key}")
        jurisdictions = item.get("jurisdictions")
        if not isinstance(jurisdictions, list) or not jurisdictions:
            raise ValueError(f"No jurisdictions for {key}")
        if any(st != "IN" and st not in states for st in jurisdictions):
            raise ValueError(f"Unrecognized jurisdiction for {key}")
        source = item.get("source")
        if not isinstance(source, str) or not source.startswith("https://"):
            raise ValueError(f"Missing HTTPS source for {key}")
        if item["status"] == "official" and not item.get("reviewed"):
            raise ValueError(f"Missing review metadata for {key}")


def build(source: dict, catalog: dict) -> dict[str, dict]:
    states = set(catalog["states"])
    records = source["records"]
    validate(records, states)
    years = sorted({record["date"][:4] for record in records})
    outputs: dict[str, dict] = {}
    manifest = {
        "version": 2,
        "source_version": source["version"],
        "note": "Partial coverage. Missing records never imply a working day.",
        "years": years,
        "jurisdictions": {},
    }
    for year in years:
        for state in ["IN", *catalog["states"]]:
            selected = [
                row for row in records
                if row["date"].startswith(year) and state in row["jurisdictions"]
            ]
            path = f"{year}/{'national' if state == 'IN' else slug(state)}.json"
            if selected:
                outputs[path] = {
                    "version": 2, "year": int(year), "jurisdiction": state,
                    "coverage": "partial",
                    "records": sorted(selected, key=lambda row: (row["date"], row["id"])),
                }
            manifest["jurisdictions"].setdefault(state, {})[year] = {
                "coverage": "partial" if selected else "not_verified",
                "count": len(selected),
                "file": path if selected else None,
            }
    outputs["manifest.json"] = manifest
    return outputs


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="Fail if published files are stale")
    args = parser.parse_args()
    source = json.loads(SOURCE.read_text(encoding="utf-8"))
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    outputs = build(source, catalog)
    for rel, data in outputs.items():
        target = DEST / rel
        contents = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
        if args.check:
            if not target.is_file() or target.read_text(encoding="utf-8") != contents:
                raise SystemExit(f"Missing or stale dataset: {target}")
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(contents, encoding="utf-8")
    print(f"Validated {len(source['records'])} sourced records; {len(outputs) - 1} partial datasets.")


if __name__ == "__main__":
    main()
