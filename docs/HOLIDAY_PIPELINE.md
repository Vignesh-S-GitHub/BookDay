# Holiday data maintenance

BookDay's existing FastAPI/HTMX/vanilla JavaScript PWA is preserved. The Worker never fetches government notices or parses PDFs. Holiday maintenance runs locally or in GitHub Actions and emits static files.

## Coverage and sources

There are **93 reviewed calendar records**, plus **65 festival-guide observances**. The original 45 records retain their IDs, dates, classification, jurisdiction, source and reviewed fields. Provenance fields were added; no original annual date was substituted.

| Jurisdiction / year | Local calendar records | Coverage |
| --- | ---: | --- |
| Tamil Nadu 2024 | 24 | Complete annual government-office schedule: 23 public dates and one bank-only closing date; later/local amendments still need review |
| Tamil Nadu 2025 | 24 | Complete annual government-office schedule: 23 public dates and one bank-only closing date; later/local amendments still need review |
| Tamil Nadu 2026 | 22 + 3 national | Preserved reviewed annual schedule plus statewide polling notice; bank-only closing remains separate |
| Kerala 2026 | 17 + 3 national | Partial selection; not a complete annual schedule |
| India 2026 / 2027 | 3 each | Partial national fixed-date selection; not a central-office annual leave calendar |
| Other states / UTs; other years | No fabricated local dates | `not_verified`; India-wide observed festivals do not prove local public leave |

The [coverage matrix](../data/holidays/coverage.json) contains every state/UT, 2024–2027 and five categories: public, bank, festival, education and district. `complete` describes the explicitly stated source scope, never all later orders or private-employer policies. Empty categories remain `not_verified`. Artwork availability does not imply date coverage.

Verified historical sources:

- [Tamil Nadu 2024 Gazette 385 / G.O. 692](https://www.stationeryprinting.tn.gov.in/extraordinary/2023/385_Ex_II_1_2023.pdf), issued 9 November 2023. The scanned [NIC archive](https://tn.nic.in/publication/list-of-holidays/) copy could not be text-parsed; the original Gazette English table was used instead.
- [Tamil Nadu 2025 Gazette 375 / G.O. 792](https://www.stationeryprinting.tn.gov.in/extraordinary/2024/375_Ex_II_1_2024.pdf), issued 22 November 2024.
- Existing 2026 Tamil Nadu/Kerala and 2026–2027 national/festival sources are preserved in [sources.json](../data/holidays/sources.json) and [FESTIVALS.md](FESTIVALS.md).
- [RBI regional bank portal](https://www.rbi.org.in/Scripts/HolidayMatrixDisplay.aspx) is verified but its interactive month/region adapter is pending. Bank leave is never general public leave.

The registry lists all 36 jurisdictions. Annual notices for other states, DoPT central-office schedules, education and district notices are pending with `url: null`; no official URL is invented. Previously reviewed sources whose original download hashes are unavailable say so explicitly. The historical PDF archives have real SHA-256 checksums and review decisions.

## Working commands

```powershell
uv sync --locked
uv run -m scripts.holiday_pipeline inspect
uv run --group data -m scripts.holiday_pipeline backfill --state "Tamil Nadu" --year 2024
uv run --group data -m scripts.holiday_pipeline backfill --state "Tamil Nadu" --year 2025
uv run --group data -m scripts.holiday_pipeline check
uv run -m scripts.holiday_pipeline validate
uv run -m scripts.holiday_pipeline publish
```

`data` contains pypdf, included in development tooling; runtime dependencies are unchanged. Backfill/check commands create candidates and detailed reports under ignored `output/holiday-pipeline/`. They never approve or publish automatically. Sources are checked sequentially, with HTTPS, robots rules, timeouts, size/page limits, conditional headers, hashes and bounded retry/backoff. No CAPTCHA bypass or OCR occurs. A source failure or unsupported layout is reported independently and retains approved data.

The explicit `tn-gazette-v1` adapter verifies all 24 numbered English rows, the declared year and every weekday. Wrapped bank/Ambedkar cells have explicit handling. Other PDF sources can be monitored for document changes; new tables require a separately tested adapter or manual review before approval. To extend: register a verified annual document, implement an explicit adapter in `adapters.py`, add an offline fixture and tests, and inspect scope before claiming source sufficiency.

## Review and publication

1. Work on a feature branch. Run `check` or `backfill`; inspect the original PDF table, extraction, date/jurisdiction/classification changes and conflicts.
2. Review every row and any removals. Different state dates are not conflicts to resolve globally. Genuine same-jurisdiction conflicts remain blocked until an explicit amendment decision is prepared.
3. Approve the exact candidate hash, record reviewer/reason, and supply the exact downloaded evidence:

```powershell
$candidate = Get-Content output/holiday-pipeline/candidates/tn-2025-annual.json -Encoding utf8 | ConvertFrom-Json
uv run --group data -m scripts.holiday_pipeline approve output/holiday-pipeline/candidates/tn-2025-annual.json --hash $candidate.candidate_hash --reviewer "Your name" --reason "Checked the original annual table and scope" --evidence output/holiday-pipeline/cache/tn-2025-annual.bin
uv run -m scripts.holiday_pipeline validate
uv run -m scripts.holiday_pipeline publish
```

Approval re-extracts evidence and rejects altered candidates, mismatched hashes or registry changes. Removal requires explicit `--allow-removals`. Re-approving the same document/extraction is idempotent. [history.json](../data/holidays/history.json) retains decisions and old/new records. Moon-sighting amendments need a new reviewed notice; old evidence and decisions stay archived.

4. Review the git diff, run quality/browser checks, and open a PR. Merge reviewed changes before production deployment under the release process. The scheduled workflow has only `contents: read` and uploads reports/candidates as artifacts. It cannot approve, push to main, merge or deploy. Download an artifact for human review; pending rows never become production data automatically.

## Publishing and browser behavior

`data/holidays/approved.json` is authoritative. Legacy literals in `prepare_data.py` remain a recovery fixture during migration; approved publication overrides them. New annual changes use data review rather than Python date edits. Catalog generation is retained. `public/data/holidays.json` remains a compatible export.

The manifest lists content-addressed year/jurisdiction datasets and checksums, coverage, artwork and reviewed amendments. Files are written before the manifest. Older hashed files are retained for cached manifests. Only the home state, optional destination and requested year are loaded; adjacent years are fetched for month borders, Home upcoming festivals and travel windows. No per-state files are created just to fill gaps.

The browser rejects stale responses and wrong-version files and keeps the booking planner usable when holiday data fails. Validated manifest and annual responses are written to the annual cache immediately, including first visits before service-worker control. The service worker refreshes annual data online with a bounded timeout and retains last-successful annual caches through updates. It does not precache every state/year. Artwork and shell use cache-first delivery; decoded image nodes survive navigation. The carousel retains its position/pause setting. Cross-tab storage updates do not reload the document.

Official general public holidays alone derive long weekends, assuming Saturday/Sunday off. Bank-only, school, district and tentative records do not count as general leave. Official festival observances can explain potential demand, with incomplete data returning “Insufficient data”; these are calendar signals, not prices. National/state/festival markers are distinct vector symbols.

Reviewed amendments appear in Calendar. A relevant saved plan gets a review/re-export link. Plans and exported Google/ICS events are never silently modified. Google export uses a browser template URL with title, details, location, opening date and selected IST time; saving in a signed-in account and native-app handling remain manual device checks.

## Cost, limits and quality

No paid API, new database or always-on service was introduced. A daily Actions job uses bounded network reads; repository/account quotas apply. Datasets and artwork remain Cloudflare static assets. Worker runtime dependencies/routing are unchanged; strict Cloudflare Free CPU compliance remains unproven in [DEPLOYMENT.md](DEPLOYMENT.md).

Offline tests never call government sites. Real archived PDFs are fixtures. Network checks are optional and reported separately. Source hashes prove file identity; human table review establishes scope. Full national/state historical coverage and future lunar dates remain incremental work, visible in the matrix.

```powershell
uv run ruff format --check .
uv run ruff check .
uv check
uv run pytest
npm test
uv run scripts/check_assets.py
```

Run the six Playwright suites documented in README, including `tests/holiday-ui-regression.js` for state labels at five widths, decoded-image reuse, historical loading, stale responses, offline access and prefilled reminder links.
