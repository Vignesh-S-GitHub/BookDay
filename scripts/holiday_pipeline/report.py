"""Potential same-jurisdiction date conflicts are reported, never auto-resolved."""

from .storage import slug


def conflicts(rows: list[dict]) -> list[dict]:
    groups = {}
    for row in rows:
        for jurisdiction in row["jurisdictions"]:
            key = (
                row["date"][:4],
                jurisdiction,
                row.get("event_key") or slug(row["name"]),
                row["type"],
            )
            groups.setdefault(key, []).append(row)
    return [
        {
            "year": key[0],
            "jurisdiction": key[1],
            "event": key[2],
            "records": values,
            "decision": "Human review required; no automatic substitution.",
        }
        for key, values in groups.items()
        if len({row["date"] for row in values}) > 1
    ]
