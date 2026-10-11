# BookDay

**Know When to Book.** A responsive, installable booking date planner for India. FastAPI provides authoritative calculations and escaped Jinja/HTMX fragments; static HTML, CSS and vanilla JavaScript handle navigation, calendars, saved plans and exports.

Live: https://bookday.vigneshshanmugam.workers.dev

## Development

Prerequisites: uv, Node.js with npm, and a Cloudflare account for deployment. The local project pins Python 3.13; the current Python Workers toolchain creates its own Pyodide environment. The app uses a `src/` layout without a distribution build backend.

```powershell
uv sync --locked
npm ci
uv run pywrangler dev
```

Open http://localhost:8787. Dependencies resolve from `uv.lock` and `package-lock.json`. The official Workers toolchain generates `python_modules`, `.venv-workers` and `pylock.toml`; these are ignored build outputs. `uv.lock` remains the Python project dependency source of truth.

```powershell
uv run pywrangler login
uv run pywrangler deploy --dry-run
uv run pywrangler deploy
```

Deployment uses `workers.asgi.entrypoint(app)` and Workers Static Assets, routing only `/api/*` and `/fragments/*` through the Python Worker. Uvicorn is not part of the Cloudflare runtime. No D1 database, paid APIs or application secrets are required. No custom domain is required for the workers.dev URL.

## Features and data

- All 14 categories use service-specific date, location and service fields over the shared date engine. Only transport forms show From/To. Hotels use Place, Check-in Date, Nights and Guests; every form has a required reminder time (IST). Provider windows are unknown by default outside the standard railway workflow.
- Day subtraction, clipped calendar months, fixed dates, recurring weekdays/month days, and Tatkal using origin-station departure and AC/non-AC times. Recurring rules find the latest matching date on or before the event. User rules are labelled unverified.
- Calendar state selection covers all 28 states and 8 UTs, with a destination overlay, keyboard day navigation, independent layers, derived long weekends and explained calendar demand signals.
- An illustrated guide covers 34 main and regional festival themes with year-specific official observances, including a preserved 65-date guide for 2026–2027 and automatically collected dates. Home, calendar details and nearby-festival insights use matching artwork. The Home date badge is separate from the title and opens the exact date. Local dates override conflicting central entries; unreviewed future dates are not guessed. See [festival sources and maintenance](docs/FESTIVALS.md).
- Official holiday calendars are collected automatically for all 28 states and 8 UTs. Daily checks backfill from 2024 through the current India year plus one and publish validated updates without manual approval. All 36 jurisdictions have 2026 records; unpublished/unavailable years retain existing data. The browser reads live data updates without a Cloudflare code deployment. Bank, restricted, district and festival-observance dates never imply general leave. See [automatic holiday maintenance](docs/HOLIDAY_PIPELINE.md).
- Versioned, validated localStorage keeps plans and settings on the device. Saved plans can be edited, completed, deleted, shared and exported. This is not cross-device sync.
- Google Calendar opens its populated editor on the booking **opening** date at the chosen reminder time. Provider opening time remains separately identified. Legacy plans without a chosen time preserve their timed/all-day behavior. The user saves there; Google manages its own notification defaults. BookDay cannot know whether that Save occurred.
- ICS exports use RFC 5545 escaping, UTF-8 octet folding, CRLF, stable UUID UIDs, UTC timed events or exclusive all-day dates, and selectable VALARM offsets. System file sharing is used where supported; download is always available. Client import/notification behavior varies.
- Dark mode, visible Home categories, reminder defaults, PWA app shell and explicit update action. New calculations require connectivity; cached saved plans and exports remain usable offline after an initial successful visit.

Reviewed rule references: [Railway advance reservation](https://www.pib.gov.in/Pressreleaseshare.aspx?PRID=2065879), [IRCTC Tatkal FAQ](https://contents.irctc.co.in/en/tatkal_faq.pdf). Holiday references are attached to individual records. Changing provider policies requires reviewing the source before updating the fixture and verification conditions.

To regenerate reviewed public fixtures: `uv run scripts/prepare_data.py`. Do not add unsourced holidays. New categories are entries in the registry; their UI does not need a separate view file. Changes to the accepted API category contract also belong in `Calculation.category`.

## Validation

```powershell
uv run ruff format --check .
uv run ruff check .
uv check
uv run pytest
uv audit
npm audit
uv run scripts/check_assets.py
```

Pytest also executes the JavaScript calendar export suite to generate fresh ICS files before independent parsing. `npm test` can run that suite alone. See [QA notes](docs/QA.md) and [deployment/CPU evidence](docs/DEPLOYMENT.md).

## Standard FastAPI fallback

```powershell
uv run uvicorn bookday.local:app --app-dir src --host 127.0.0.1 --port 8000
```

A conventional ASGI host can use the same entrypoint and date logic. For a production fallback, install Uvicorn in that host's runtime dependency group, serve over HTTPS and arrange the host's process management. Its availability and cost must be evaluated separately; no other host is silently provisioned.

## Privacy and limitations

Plans, routes, titles, reminder offsets and settings are device-local. Calculation requests send only dates, rule values and category. Calendar export/share sends the selected fields to the user's chosen destination. Cloudflare handles request metadata and operational logs; the application does not log form bodies. Roboto is bundled locally under its SIL Open Font License, including offline use.

No live prices, seats, slot availability, automatic purchases, sign-in, push/email/Telegram delivery or background reminder scheduler is implemented. Calendar apps deliver reminders after save/import according to their settings. All artwork was newly generated from the eight screenshot references; the five-scene Home carousel supports automatic/manual navigation, pause/play and swipe, and all 36 state/UT travel selections update original scenery and destination copy. Travel selection hands destination/date/nights to the hotel planner. Shared searchable dropdowns, date/time pickers and number steppers match the theme; the supplied design-kit assets are no longer served. The mobile layouts preserve the references' colors, card arrangement and visual hierarchy, with dynamic dates and truthful service behavior. The device bezel and operating-system status bar belong to the reference mockups and are not drawn into the web app. HTMX's license is included in `public/vendor/HTMX-LICENSE.txt`.

## Artwork and browser regression

The 106 newly generated raster images, including 34 festival themes, live in `public/art/`; vector UI icons are in `public/art/icons.svg`. [Artwork prompts](docs/artwork.json) record each new asset, its saved path and its built-in image-generation prompt. `scripts/package_art.mjs` resizes and encodes generated PNG originals into sharp WebP assets. PNG originals are kept in the image-generation library; the deployable files are committed here. Original user inputs are preserved locally in the ignored `reference-inputs/` folder. The extracted design-kit folder and obsolete served assets were removed.

The committed browser suite covers all categories, planning, saved-plan menus, calendar exports, settings, source-backed insights, responsive layouts, first installation, malformed storage and offline exports:

```powershell
npx --yes --package @playwright/cli playwright-cli open http://localhost:8787
npx --yes --package @playwright/cli playwright-cli run-code --filename tests/ui-regression.js
```

Use an isolated test browser. The suite creates a temporary browser context and does not alter the normal user's plans. Local visual captures are saved under ignored `output/playwright/`. Physical calendar-client checks and Cloudflare CPU limitations are described in the QA and deployment notes.

### Themed control regression

After opening the running app with Playwright CLI: `npx --yes --package @playwright/cli playwright-cli run-code --filename tests/controls-regression.js`. This exercises searchable destinations, steppers, trip handoff, required reminder time and the shared date/time pickers.

All-state banner and verified-calendar regression: `npx --yes --package @playwright/cli playwright-cli run-code --filename tests/destination-regression.js`.

Carousel autoplay, pause, swipe and reduced-motion regression: `npx --yes --package @playwright/cli playwright-cli run-code --filename tests/carousel-regression.js`.

Festival images, annual dates, Home readability and navigation, guide layers, year boundaries and offline artwork: `npx --yes --package @playwright/cli playwright-cli run-code --filename tests/festivals-regression.js`.

## Holiday pipeline and UI maintenance

The reviewed-data pipeline, source registry, historical backfill, category/state/year coverage matrix and manual approval commands are documented in [HOLIDAY_PIPELINE.md](docs/HOLIDAY_PIPELINE.md). There are 93 calendar records (including 24 each for Tamil Nadu 2024/2025) plus 65 reviewed festival-guide observances. Unverified regions remain explicit; festival dates do not automatically imply public leave.

Mobile state names and Next Booking cards now retain their contents within the theme. Artwork is cached and decoded images are reused between screen visits. The install icon has a white background. Saved movie/hotel/tourism plans use newly generated cinema/resort/coast thumbnails; generation prompts and paths are in [artwork.json](docs/artwork.json).

Historical data loading, stale-request protection, all 36 state labels at five widths, image reuse, offline data and Google event prefill:

```powershell
npx --yes --package @playwright/cli playwright-cli run-code --filename tests/holiday-ui-regression.js
```

The daily source workflow uploads pending candidates/reports for human review. It has no permission to merge or publish unreviewed records.

Selected-state festival filtering, faith-specific day markers and the single-icon Travel Date picker: `npx --yes --package @playwright/cli playwright-cli run-code --filename tests/regional-festivals-regression.js`.

## Final icon and reminder defaults

Small UI icons use a single document-local SVG symbol library, loaded once before the first screen and retained across tab switches. New reminder forms in all 14 categories default to today's date in Asia/Kolkata. Editing saved reminders and transferring an explicitly selected travel date preserves that date.

Regression: `npx --yes --package @playwright/cli playwright-cli run-code --filename tests/final-release-regression.js`. This checks one icon fetch, visible symbols on every tab/form, daily and India-midnight date rollover, and saved/edit/trip-date preservation.
