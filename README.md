<div align="center">

<img src="public/art/app-icon.svg" alt="BookDay logo" width="96" />

# BookDay

**Know When to Book.**

![Python 3.13](https://img.shields.io/badge/Python%203.13-3776AB?style=flat-square&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)
![Cloudflare](https://img.shields.io/badge/Cloudflare-F38020?style=flat-square&logo=cloudflare&logoColor=white)

[Open BookDay](https://bookday.vigneshshanmugam.workers.dev) · [Quick start](#quick-start) · [Features](#features) · [Documentation](#documentation)

</div>

---

A responsive, installable booking-date planner for India. FastAPI calculates booking openings; a lightweight HTML/CSS/JavaScript interface provides calendars, device-local plans, holiday context, and calendar exports. The hosted app uses Cloudflare Python Workers and Static Assets.

<a id="features"></a>

## ✨ Features

| Area | What is implemented |
|---|---|
| 📅 Booking calculations | Day/month subtraction, fixed dates, recurring weekdays/month days, and origin-date-aware Tatkal calculations |
| 🎟️ Service forms | Fourteen categories with service-specific fields and a required reminder time in IST |
| 🇮🇳 Holiday context | State/UT selection across all 28 states and 8 UTs, source metadata, calendar layers, and derived long weekends |
| 🪔 Festivals and travel | Regional festival illustrations, reviewed observances, destination scenery, and hotel-planner handoff |
| 💾 Saved plans | Edit, complete, delete, share, and export plans stored in versioned browser localStorage |
| 🗓️ Calendar exports | Google Calendar editor links and ICS with reminder offsets |
| 📱 PWA | Cached shell, saved-plan access, and exports offline after an initial successful visit |

Provider opening windows remain **unknown by default** outside the verified railway workflow. User-defined rules are labelled unverified. Holiday/festival context does not establish live demand, prices, seat availability, or guaranteed leave.

<a id="quick-start"></a>

## 🚀 Quick start

Requirements: [uv](https://docs.astral.sh/uv/), Node.js/npm, and the project's pinned **Python 3.13** environment. The Python Workers toolchain creates its own Pyodide environment.

```bash
git clone https://github.com/Vignesh-S-GitHub/BookDay.git
cd BookDay
uv sync --locked
npm ci
uv run pywrangler dev
```

Open **http://localhost:8787**. Keep `uv.lock` and `package-lock.json` as dependency sources of truth; generated Workers environments are ignored build outputs.

For a conventional local FastAPI server:

```bash
uv run uvicorn bookday.local:app --app-dir src --host 127.0.0.1 --port 8000
```

## 🧭 Use the planner

1. Select a category and enter its event/journey/service details.
2. Choose or configure the booking-opening rule and review its verification state.
3. Set your reminder time in India time and inspect the calculated opening.
4. Save the plan locally, or open its Google Calendar editor/export an ICS event.
5. Finish saving/importing in the calendar app; that app controls notification delivery.

Calendar events are based on the **booking-opening date**, not simply the journey date. Google Calendar prefill cannot confirm that a user clicked Save. New calculations require connectivity; cached saved plans and exports remain available offline.

## 🧱 Architecture and data

| Layer | Implementation |
|---|---|
| Date engine/API | [src/bookday/](src/bookday/), FastAPI and escaped Jinja/HTMX fragments |
| Worker entry | [src/worker.py](src/worker.py), ASGI entrypoint |
| Frontend | [public/](public/), local assets, service worker, and browser storage |
| Holiday source tooling | [scripts/holiday_pipeline/](scripts/holiday_pipeline/) |
| Provenance | [data/holidays/](data/holidays/), source registry, historical caches, and records |

Worker routing sends `/api/*` and `/fragments/*` to Python while other assets use Static Assets. There is no D1 application database, account login, or required paid API.

## 🔄 Holiday maintenance

[Automatic holiday updates](.github/workflows/holiday-sources.yml) is configured for **03:23 UTC / 08:53 IST daily**, plus manual dispatch and relevant source-data changes. It restores published data, collects sources, validates, runs checks, and publishes validated data from `main`.

The current workflow **does publish validated automatic updates**; it is not a pending-only manual approval workflow. It retains reports as Actions artifacts. Unavailable/unpublished years retain prior data instead of guessed dates. The app can load published holiday updates without a code redeployment.

See [holiday pipeline](docs/HOLIDAY_PIPELINE.md) and [festival maintenance](docs/FESTIVALS.md). General, restricted, bank, district, and festival-observance records have distinct meanings.

## 🧪 Validation

```bash
uv run ruff format --check .
uv run ruff check .
uv check
uv run pytest
npm test
uv run scripts/check_assets.py
```

The Python suite includes independent parsing of fresh JavaScript-generated ICS output. Browser regressions cover forms, controls, calendar exports, responsive layouts, storage recovery, artwork, and offline exports. Use an isolated test browser; details and commands are in [QA notes](docs/QA.md).

## ☁️ Deployment

From an authenticated Cloudflare environment:

```bash
uv run pywrangler login
uv run pywrangler deploy --dry-run
uv run pywrangler deploy
```

Review [wrangler.jsonc](wrangler.jsonc) for your account and destination. The current configuration serves the `bookday` Worker on workers.dev; no custom domain is required. GitHub CI is a validation workflow, separate from this explicit application release. See [deployment and CPU evidence](docs/DEPLOYMENT.md).

## 🔐 Privacy and scope

Plans, titles, routes, settings, and reminder offsets stay in browser localStorage. Calculation requests contain dates, rule values, and category. Sharing/calendar actions send the chosen event fields to the selected destination. Cloudflare processes request metadata; the application does not log form bodies.

BookDay does not implement live prices, availability checks, purchases, sign-in, push/email/Telegram delivery, or a background reminder scheduler. Calendar clients deliver notifications after save/import, subject to their own settings. Clearing browser storage can remove saved plans.

<a id="documentation"></a>

## 📚 Documentation

[Deployment](docs/DEPLOYMENT.md) · [QA](docs/QA.md) · [Holiday pipeline](docs/HOLIDAY_PIPELINE.md) · [Festivals](docs/FESTIVALS.md) · [Artwork prompts](docs/artwork.json) · [Repository audit](docs/REPOSITORY_AUDIT.md).

Generated festival and travel artwork is illustrative. The project uses generated raster assets and local SVG UI symbols; Roboto and HTMX carry their own third-party notices in the served asset directories.

## 🤝 Contributing

Submit focused changes with appropriate Python, JavaScript, and asset checks. Keep verified rules and holiday provenance separate from user-defined assumptions.

## 📄 License and notices

`package.json` declares ISC; no standalone repository-level `LICENSE` file is included. Roboto and HTMX retain their separate font/vendor license notices.
