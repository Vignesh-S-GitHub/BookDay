# Cloudflare deployment and performance

BookDay was deployed with `uv run pywrangler deploy` on 11 October 2026 to:

https://bookday.vigneshshanmugam.workers.dev

The proof of concept used FastAPI via `workers.asgi.entrypoint`, a compiled Jinja `DictLoader`, local HTMX and Workers Static Assets. Both JSON calculation and genuine POST-to-HTML fragment routes worked in Cloudflare's local Python runtime and on the deployed Worker. Templates require no conventional filesystem loader, and user strings are escaped.

## Recorded deployments

| Stage | Worker version | Startup | Compressed Worker upload |
| --- | --- | ---: | ---: |
| Initial proof of concept | `b6055117-49a9-4704-9102-841263dd2a24` | 2498 ms | 2473.12 KiB |
| Complete V1 first deployment | `66665067-f1bd-4d7a-a444-3377e795baed` | 2561 ms | 2474.02 KiB |
| Formatted V1 deployment | `f593c2ab-0a98-4690-a6fd-cb5bc09d2e0f` | 2137 ms | 2474.02 KiB |
| Screenshot-guided visual rebuild | `5350e92a-428c-43d5-8ed9-6c0a94029967` | 2248 ms | 2474.02 KiB |

The visual rebuild replaces the entire served design kit with 36 newly generated images, a new vector icon sprite and a bundled licensed font. It adds the compact reference layouts while preserving date calculations and device-local storage. Static assets route directly through Cloudflare's asset store; only `/api/*` and `/fragments/*` invoke Python. No database or paid API is provisioned. No billing plan upgrade was requested or enabled. The Python runtime and calculation code are unchanged; the CPU evidence below remains a limitation, and no new strict Free-tier capacity claim is made.

## CPU evidence

Measurements use Cloudflare `wrangler tail`'s `cpuTime`, not HTTP round-trip duration or Python wall-clock timing. Only path, version, CPU/wall milliseconds, outcome and response status are retained in [cpu-benchmark.json](cpu-benchmark.json). Tail delivery yielded a smaller sample than the number of HTTP smoke requests; no missing measurement is assumed to be fast or successful.

For the complete V1 first deployment:

| Route | Observed samples | Min CPU | Median CPU | Max CPU | Samples above 10 ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| `/api/calculate` | 7 | 6 ms | 8 ms | 32 ms | 2 |
| `/fragments/calculate` | 5 | 7 ms | 14 ms | 57 ms | 3 |
| `/api/health` | 1 | 45 ms | 45 ms | 45 ms | 1 |

Two complete runs of 20 JSON and 20 HTMX calculation calls returned HTTP 200, and static-asset smoke checks returned 200. These are small sequential functional samples, not a production load test. The initial proof of concept also had higher first-use spikes, preserved in the JSON evidence.

**Free CPU compatibility is not proven.** Successful 200 responses do not establish compliance with the [published Workers Free 10 ms CPU limit](https://developers.cloudflare.com/workers/platform/limits/). Cloudflare allows some CPU-limit flexibility, which is not a capacity guarantee. The observed fragment median and occasional API spikes exceed that budget. BookDay therefore does not claim a validated zero-cost production SLA or reliable Free-tier operation under all traffic.

Most interaction is static/browser-side to reduce Worker use: calendar clicks, countdowns, saved plans, settings, Google URLs and ICS generation do not invoke Python. The remaining date calculation endpoint is authoritative. Full-page server rendering is deliberately avoided. To require strict zero-cost reliability, further runtime profiling or a changed deployment constraint is needed before making that claim.

## Reproduce or use a standard host

```powershell
uv sync --locked
npm ci
uv run pywrangler dev
uv run pywrangler deploy --dry-run
uv run pywrangler deploy
uv run pywrangler tail bookday --format json
```

To sanitize a captured tail file at the ignored `output-tail.jsonl` path, run `uv run scripts/benchmark_report.py`. Raw tail output includes request metadata and is never committed.

The documented standard FastAPI fallback keeps the same app and booking logic:

```powershell
uv run uvicorn bookday.local:app --app-dir src --host 127.0.0.1 --port 8000
```

For a conventional production host, include Uvicorn in that host's runtime requirements, use HTTPS, a service process manager and static response security headers equivalent to `public/_headers`. Assess that host's costs and sleep policy separately. No alternate paid host has been provisioned.
