"""Deterministic storage and validation for reviewed holiday records."""

import hashlib
import json
import re
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data/holidays"


def read(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(value, ensure_ascii=False, indent=2) + "\n"
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(text, encoding="utf-8", newline="\n")
    temporary.replace(path)


def digest(value: object) -> str:
    return hashlib.sha256(
        json.dumps(value, sort_keys=True, ensure_ascii=False).encode()
    ).hexdigest()


def slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def validate(rows: list[dict], states: list[str]) -> None:
    ids = set()
    for row in rows:
        date.fromisoformat(row["date"])
        if row["id"] in ids:
            raise ValueError(f"Duplicate ID: {row['id']}")
        ids.add(row["id"])
        if not row["name"].strip() or not row["source"].startswith("https://"):
            raise ValueError("Missing name or HTTPS source")
        if not row["jurisdictions"] or not set(row["jurisdictions"]) <= {"IN", *states}:
            raise ValueError("Unknown jurisdiction")
        if row["status"] not in {"official", "tentative", "unverified", "unannounced"}:
            raise ValueError("Invalid publication status")
        if row["type"] not in {
            "national_public",
            "state_public",
            "bank_holiday",
            "religious_festival",
            "school_holiday",
            "local_event",
        }:
            raise ValueError("Invalid event classification")
        if row.get("provenance", {}).get("review_decision") != "approved":
            raise ValueError("Publication requires an approved review")


def changes(old: list[dict], new: list[dict]) -> dict:
    before, after = {r["id"]: r for r in old}, {r["id"]: r for r in new}
    return {
        "added": [after[k] for k in sorted(after.keys() - before.keys())],
        "removed": [before[k] for k in sorted(before.keys() - after.keys())],
        "changed": [
            {"id": k, "old": before[k], "new": after[k]}
            for k in sorted(before.keys() & after.keys())
            if before[k] != after[k]
        ],
    }


def source_changes(old: list[dict], new: list[dict]) -> dict:
    """Extraction diffs exclude review metadata added after approval."""
    fields = [
        "id",
        "date",
        "name",
        "jurisdictions",
        "type",
        "status",
        "source",
        "district",
        "scope",
        "event_key",
    ]
    return changes(
        [{key: row.get(key) for key in fields} for row in old],
        [{key: row.get(key) for key in fields} for row in new],
    )
