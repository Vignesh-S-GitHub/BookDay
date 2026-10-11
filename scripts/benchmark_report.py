"""Sanitize wrangler tail output into CPU-only evidence, without request metadata."""

import json
import statistics
from collections import defaultdict
from pathlib import Path
from urllib.parse import urlparse

root = Path(__file__).resolve().parents[1]
raw = (root / "output-tail.jsonl").read_bytes()
text = raw.decode("utf-16" if raw.startswith(b"\xff\xfe") else "utf-8-sig")
decoder = json.JSONDecoder()
position = 0
rows: list[dict[str, object]] = []
while position < len(text):
    start = text.find("{", position)
    if start < 0:
        break
    try:
        event, consumed = decoder.raw_decode(text[start:])
        position = start + consumed
    except json.JSONDecodeError:
        position = start + 1
        continue
    if "cpuTime" not in event:
        continue
    request = event.get("event", {}).get("request", {})
    rows.append(
        {
            "version": event.get("scriptVersion", {}).get("id"),
            "path": urlparse(request.get("url", "")).path,
            "cpu_ms": event["cpuTime"],
            "wall_ms": event["wallTime"],
            "outcome": event["outcome"],
            "status": event.get("event", {}).get("response", {}).get("status"),
        }
    )
grouped = defaultdict(list)
for row in rows:
    grouped[(row["version"], row["path"])].append(row["cpu_ms"])
summary = [
    {
        "version": version,
        "path": path,
        "count": len(values),
        "min_cpu_ms": min(values),
        "median_cpu_ms": statistics.median(values),
        "max_cpu_ms": max(values),
        "over_10ms": sum(value > 10 for value in values),
    }
    for (version, path), values in grouped.items()
]
(root / "docs").mkdir(exist_ok=True)
(root / "docs" / "cpu-benchmark.json").write_text(
    json.dumps(
        {
            "method": "Deployed Cloudflare wrangler tail cpuTime. Small sequential sample, not a load test or SLA. No request bodies collected.",
            "summary": summary,
            "samples": rows,
        },
        indent=2,
    )
    + "\n",
    encoding="utf-8",
)
print(json.dumps(summary, indent=2))
