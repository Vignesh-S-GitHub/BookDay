# Holiday datasets: stage 1 (safe publication)

The BookDay holiday fixture is currently curated in `scripts/prepare_data.py`,
which writes `public/data/holidays.json`. This change adds a deterministic
validation and publication stage. **It does not claim national completeness,
historic backfill, or automatic parsing of government PDF notices.**

Run `uv run scripts/prepare_data.py`, then
`uv run scripts/holiday_pipeline.py`. To verify the published outputs, run
`uv run scripts/holiday_pipeline.py --check`.

The generator creates a manifest covering all 36 states and UTs, plus `IN`,
for the years present in reviewed records. It writes *only* non-empty verified
source-backed partial files. An empty state/year is marked `not_verified`,
never presented as a working day. Every record retains its v1 provenance.

For safety, `public/data/holidays.json` and its existing app consumers remain
unchanged at this stage. A future PR should add a static state/year loader,
coverage-aware rendering, offline caching, amendment review, and automated
source ingestion. Each official PDF must be checked against its published table
before a candidate date is approved.

Current verified fixture is not complete for 2024/2025 or nationwide 2026.
No daily website scraping, unsupervised modification, or production
deployment is introduced in this preliminary stage.
