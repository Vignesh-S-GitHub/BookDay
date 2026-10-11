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

- All 14 categories share one functional calculator. Provider windows are unknown by default outside the standard railway workflow.
- Day subtraction, clipped calendar months, fixed dates, recurring weekdays/month days, and Tatkal using origin-station departure and AC/non-AC times. Recurring rules find the latest matching date on or before the event. User rules are labelled unverified.
- Calendar state selection covers all 28 states and 8 UTs, with a destination overlay, keyboard day navigation, independent layers, derived long weekends and explained calendar demand signals.
- Curated records include annual national holidays for 2026–2027 and selected Kerala 2026 records. This is an incomplete example dataset, with official URLs, jurisdiction, type, status and review date in each record. State and festival coverage is not complete. Bank holidays never create general long weekends; religious festivals alone never imply public holidays.
- Versioned, validated localStorage keeps plans and settings on the device. Saved plans can be edited, completed, deleted, shared and exported. This is not cross-device sync.
- Google Calendar opens its populated editor using the booking **opening** date/time. The user saves there; Google manages its own notification defaults. BookDay cannot know whether that Save occurred.
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

No live prices, seats, slot availability, automatic purchases, sign-in, push/email/Telegram delivery or background reminder scheduler is implemented. Calendar apps deliver reminders after save/import according to their settings. All artwork was newly generated from the eight screenshot references; the supplied design-kit assets are no longer served. The mobile layouts preserve the references' colors, card arrangement and visual hierarchy, with dynamic dates and truthful service behavior. The device bezel and operating-system status bar belong to the reference mockups and are not drawn into the web app. HTMX's license is included in `public/vendor/HTMX-LICENSE.txt`.

## Artwork and browser regression

The 36 new raster images live in `public/art/`; vector UI icons are in `public/art/icons.svg`. [Artwork prompts](docs/artwork.json) record each new asset, its saved path and its built-in image-generation prompt. `scripts/package_art.mjs` resizes and encodes generated PNG originals into sharp WebP assets. PNG originals are kept in the image-generation library; the deployable files are committed here. Original user inputs are preserved locally in the ignored `reference-inputs/` folder. The extracted design-kit folder and obsolete served assets were removed.

The committed browser suite covers all categories, planning, saved-plan menus, calendar exports, settings, source-backed insights, responsive layouts, first installation, malformed storage and offline exports:

```powershell
npx --yes --package @playwright/cli playwright-cli open http://localhost:8787
npx --yes --package @playwright/cli playwright-cli run-code --filename tests/ui-regression.js
```

Use an isolated test browser. The suite creates a temporary browser context and does not alter the normal user's plans. Local visual captures are saved under ignored `output/playwright/`. Physical calendar-client checks and Cloudflare CPU limitations are described in the QA and deployment notes.
