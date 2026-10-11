# Verification — 11 October 2026

## Executed checks

- 29 pytest tests pass, including date arithmetic, leap years, calendar-month clipping, year boundaries, past dates, timezone boundaries, fixed/recurring rules, invalid input, standard rail and originating-station Tatkal behavior.
- The pytest run executes 5 Node calendar export tests. An independent `icalendar` parser accepts the generated timed and all-day ICS files, Unicode Tamil text, escaped locations and multiple alarms. Tests assert CRLF and the 75-octet folding limit.
- Ruff formatting/lint, ty, JavaScript syntax and Prettier checks pass. Python and npm audits report no known vulnerabilities in the resolved dependencies.
- Asset/data checks verify 14 category images, all 36 jurisdictions, PWA brand assets and 23 sourced calendar records.
- Cloudflare local Python runtime and real deployed health, JSON calculation and HTML fragment routes return 200. Deployed manifest, service worker, HTMX and logo assets return 200.
- The optional Uvicorn ASGI fallback starts and serves the same routes and frontend.

## Browser checks executed

Chromium at 390×844, plus 360×844 and 1280×844 layout checks:

- Home, Explore, Calendar, Saved, Settings, Insights, and train calculator navigation; all 14 category workflows calculate. Unknown categories do not invent opening windows and disable calendar exports until dates are known.
- A 15 December 2026 journey with a 60-day rule produces 16 October 2026. Editing that plan to Tatkal with 14 December origin departure and non-AC class produces 13 December at 11:00 IST.
- Save and edit retain date/title, save preserves the same UUID, and saved plans remain after reload. State selection survives reload. Malformed JSON storage displays defaults and an explanatory message; valid plans can be restored.
- The Google Calendar link uses the opening timestamp, correct IST timezone, supported fields and a 15-minute duration. All-day output uses exclusive end dates. A browser-generated ICS file downloads successfully.
- Native file-sharing, unsupported file-sharing download fallback, and canceled sharing were exercised with browser API stubs. Cancellation is not reported as a successful import.
- Month/year controls, a 42-cell Sunday-first date grid, Kerala state records and arrow-key day movement work. The Kerala Christmas insight explains its holiday/weekend signal.
- Dark mode, device storage, initial service-worker caching, offline reload of saved plans, and offline calendar export options work. New calculations require network access.
- No horizontal overflow at 360, 390, or 1280 pixels across the primary screens. All visible assets finish loading. Screenshots were inspected against all eight design references. The separate supplied illustrations and original logo are used; the kit does not contain the photographic mockup backgrounds.
- Final local browser console check shows no errors or warnings.

Local screenshots and browser download evidence are in `output/playwright/`, intentionally excluded from Git. Source fixtures and sanitized CPU evidence are committed.

## Remaining device/client checks

These have **not** been performed on physical Android/iOS devices or signed-in calendar accounts:

- Google Calendar editor appearance and the user's final Save tap on mobile/PWA/desktop.
- Import behavior and notification delivery in Apple Calendar, Outlook and Google Calendar. Independent ICS parsing proves format interoperability, not that every client honors alarms.
- Actual native OS chooser availability, installed provider targets and cancellation on each device. The browser API branch tests use stubs.
- Home Screen installation prompts on iOS/Android and real update cycles across released app versions. Manifest, service-worker installation, cache and explicit update handling are implemented; supported browsers decide installation eligibility.

No push/email scheduler or notification permission flow is included in V1. Holiday coverage remains limited to curated examples, and reliable adherence to Workers Free's 10 ms CPU budget is not established; see `DEPLOYMENT.md`.
