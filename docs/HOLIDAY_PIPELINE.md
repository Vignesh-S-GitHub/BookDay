# Automatic holiday maintenance

BookDay checks the official [National Portal of India calendar](https://www.india.gov.in/calendar) for all **28 states and 8 Union Territories**. The scheduled workflow validates and publishes available records automatically. No reviewer, approval, release button, Cloudflare secret or annual code edit is required.

## Schedule and year coverage

`.github/workflows/holiday-sources.yml` runs daily at 03:23 UTC (08:53 IST; GitHub may delay scheduled jobs), on relevant main-branch changes and on demand. Each run checks **2024 through the current India year plus one**, so historical gaps are retried and next-year calendars are imported when the authority publishes them. The year range advances automatically.

The initial import includes validated 2026 records for **all 36 configured jurisdictions**, with available 2024/2025 historical records and published central festival dates through 2027. State calendars for 2027 were not yet published at the time of this release. Missing, malformed, unpublished or unavailable sources leave previous records intact and are retried on subsequent runs. BookDay never copies a lunar festival's date into another year or assumes that a missing source means no holidays.

`data/holidays/coverage.json` and the live manifest describe each year, jurisdiction and category. A complete paginated feed is not a promise that every later local order or employer schedule has been included. Categories without an established annual source scope remain partial or unavailable.

## Source and validation

The collector uses the same public structured calendar route as the official portal's frontend: HTTPS POST `/internal/cms`, with a `route` selecting `/api/state-holidays` filtered by the state's official alias, or `/api/calendar-holidays` for central observances. Explicit aliases cover the eight UTs. No authentication or paid API is needed.

The collector requires published records, complete stable pagination, unique source IDs, known state association and holiday classification, valid civil dates in the requested year, matching weekdays and safe titles. Requests have timeouts, size/page limits and bounded retries; four concurrent readers keep load bounded. A malformed public row rejects that state/year replacement rather than publishing a partial extraction.

- Only state **Gazetted** holidays enter the public calendar. State **Restricted** holidays are excluded from general leave.
- Central festival dates remain **observances**, not a claim of public leave in every state. Regional display uses the state association and known local festival identities.
- Republic Day, Independence Day and Gandhi Jayanti are classified separately and deduplicated when states repeat the national date.
- Bank closing days remain bank-only. They cannot create general long weekends.
- Puducherry entries carry a region-specific warning because Puducherry/Karaikal, Mahe and Yanam may have different calendars. These do not imply a territory-wide long weekend.
- Different state dates and genuine multiple-day celebrations are preserved.

Retrieved source JSON is archived with SHA-256 fingerprints in the workflow artifact. Published records include the official source URL, source ID, retrieval/validation timestamps, parser fingerprint and `automatically_validated` decision. The historical reviewed snapshot and PDFs remain archived in `approved.json` and `documents/`; routine automation overlays available official updates without changing those archives. Specific local notices absent from the portal, such as the Tamil Nadu polling-day notice, are retained.

## Automatic publication and browser delivery

After validation and regression checks, the workflow commits the generated snapshot, manifest and annual datasets to the public **`holiday-data` branch**, using GitHub's built-in workflow token with `contents: write`. One Git push publishes the manifest and its referenced files together. No production code merge or Cloudflare deployment is needed for subsequent data updates. The job has no approval environment.

The Cloudflare-hosted app reads the live manifest from that branch through `raw.githubusercontent.com`. It loads only the selected years and jurisdictions and checks dataset versions and SHA-256 checksums. Immutable content-addressed filenames prevent old/new release mixing; previously published files are retained for cached manifests. The manifest is checked on a new visit and after 15 minutes when another relevant data selection is loaded.

The last successful live manifest and annual files are cached for offline use. A source/network failure preserves that cache; first visits can use the bundled snapshot. Invalid manifests cannot overwrite valid cached data. Artwork and small icons continue using the existing cache and shared inline sprite, without a per-tab reload.

## Working commands

```powershell
uv sync --locked --group data
uv run -m scripts.holiday_pipeline sync
uv run -m scripts.holiday_pipeline sync --from-year 2024 --through-year 2027
uv run -m scripts.holiday_pipeline validate
uv run -m scripts.holiday_pipeline publish
```

The workflow runs `holiday_pipeline.release restore` before collection and `holiday_pipeline.release publish` after checks. The latter pushes only the data branch. The old PDF `check`, `backfill` and `approve` tools are retained for archived fixtures and exceptional explicitly sourced notices; they are **not part of unattended updates** and cannot hold up the new structured-feed pipeline.

General public holidays alone derive long weekends, assuming Saturday/Sunday off. School, bank, regional and tentative entries do not establish general leave. Calendar demand is an explained heuristic, not live prices or availability. Saved plans and already exported calendar events are never silently changed by a holiday update.

## Validation and operational limits

```powershell
uv run ruff format --check .
uv run ruff check .
uv check
uv run pytest
npm test
uv run scripts/check_assets.py
```

Offline fixtures exercise all 36 aliases, unavailable sources, pagination, date/classification validation, idempotence, regional scope and automatic publication. Browser regressions cover live feed loading, Today beside All, month/year jumps, state-specific dates and offline data. Source availability and correct upstream publication remain external dependencies; a feed format change is reported and retained data stays available rather than guessed. Daily collection and publishing need no human approval, but cannot manufacture an unpublished calendar.
