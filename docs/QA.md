# Verification — 11 October 2026

## Executed checks

- 35 pytest tests pass, including date arithmetic, leap years, calendar-month clipping, year boundaries, past dates, timezone boundaries, fixed/recurring rules, invalid input, standard rail and originating-station Tatkal behavior, plus five new artwork/font/offline-shell regressions.
- The pytest run executes 9 Node calendar export/category/destination tests. An independent `icalendar` parser accepts the generated timed and all-day ICS files, Unicode Tamil text, escaped locations and multiple alarms. Tests assert CRLF and the 75-octet folding limit.
- Ruff formatting/lint, ty, JavaScript syntax and Prettier checks pass. Python and npm audits report no known vulnerabilities in the resolved dependencies.
- Asset/data checks verify all 70 newly generated WebP images, vector symbols, the locally licensed font, all 36 jurisdictions, PWA brand assets and 45 sourced calendar records. No obsolete `/assets/` reference remains in the app shell.
- Cloudflare local Python runtime and real deployed health, JSON calculation and HTML fragment routes return 200. Deployed manifest, service worker, HTMX and logo assets return 200.
- The optional Uvicorn ASGI fallback starts and serves the same routes and frontend.

## Browser checks executed

The committed `tests/ui-regression.js` was executed in Chromium at 390×844, with 320, 360, 390, 430 and 1280 pixel layout checks:

The complete suite also passed against final live Cloudflare version `7949d257-7a9e-4c2d-a328-bc8e3def3c2c`, with zero browser console errors. The calendar calculation and export assertions ran against the deployed Python Worker, and offline checks used the released service-worker asset list. The final symbol regression verifies that the Gandhi Jayanti flag disappears when Holidays is disabled, even while Demand Signals remains enabled.

- Home, Explore, Calendar, Saved, Settings, Insights, and train calculator navigation; all 14 category workflows calculate. Unknown categories do not invent opening windows and disable calendar exports until dates are known.
- A 15 December 2026 journey with a 60-day rule produces 16 October 2026. Editing that plan to Tatkal with 14 December origin departure and non-AC class produces 13 December at 11:00 IST.
- Save and edit retain date/title, save preserves the same UUID, and saved plans remain after reload. State selection survives reload. Malformed JSON storage displays defaults and an explanatory message; valid plans can be restored.
- The Google Calendar link uses the opening timestamp, correct IST timezone, supported fields and a 15-minute duration. All-day output uses exclusive end dates. A browser-generated ICS file downloads successfully.
- Native file-sharing, unsupported file-sharing download fallback, and canceled sharing were exercised with browser API stubs. Cancellation is not reported as a successful import.
- Month/year controls, a Sunday-first date grid, Kerala state records and arrow-key day movement work. The DOM retains 42 dates; surplus trailing weeks are hidden when the month needs fewer rows. The Kerala Christmas insight explains its holiday/weekend signal. The new train mini-calendar updates the journey date in both directions.
- Dark mode, device storage, initial service-worker caching, offline reload of saved plans, and offline calendar export options work. New calculations require network access.
- No horizontal overflow at 320, 360, 390, 430 or 1280 pixels across the primary screens. All visible assets and the local font finish loading. New photographic banners, 3D tiles, Home cutouts, logo, result illustration and Saved thumbnails replace the entire supplied kit. All eight reference screens guided the layout and visual inspection; newly generated artwork has visual differences from the source screenshots, so pixel identity is not claimed.
- Final local browser console check shows no errors or warnings.

Local screenshots and browser download evidence are in `output/playwright/`, intentionally excluded from Git. Source fixtures and sanitized CPU evidence are committed.

## Remaining device/client checks

These have **not** been performed on physical Android/iOS devices or signed-in calendar accounts:

- Google Calendar editor appearance and the user's final Save tap on mobile/PWA/desktop.
- Import behavior and notification delivery in Apple Calendar, Outlook and Google Calendar. Independent ICS parsing proves format interoperability, not that every client honors alarms.
- Actual native OS chooser availability, installed provider targets and cancellation on each device. The browser API branch tests use stubs.
- Home Screen installation prompts on iOS/Android and real update cycles across released app versions. Manifest, service-worker installation, cache and explicit update handling are implemented; supported browsers decide installation eligibility.

No push/email scheduler or notification permission flow is included in V1. Tamil Nadu 2026 annual holidays and the later statewide polling holiday are sourced from official gazettes; other state/UT and local coverage remains incomplete, and reliable adherence to Workers Free's 10 ms CPU budget is not established; see `DEPLOYMENT.md`.

## Dynamic planners and controls update

The full browser suite, themed-controls suite and all-state destination suite also passed on the final live Cloudflare Worker `29d7d311-b592-4905-8636-7013f33db9bb`. The separate carousel suite verified automatic rotation, pause, swipe navigation and paused-by-default behavior with reduced motion enabled.

- Local full browser regression passed with five carousel scenes, manual navigation, pause/play, all 14 purpose-specific booking forms, required visible reminder time, state search, stay steppers and travel-to-hotel destination/date/nights handoff. Existing saved-plan, date-engine, calendar, sharing and offline regressions continue to pass across 320/360/390/430/1280 widths.
- `tests/controls-regression.js` passed: searchable dropdown, number stepper, themed time picker, leap-day date picker, trip handoff and required-time validation.
- `tests/destination-regression.js` passed: Tamil Nadu default, 36 distinct loaded state/UT banners with corresponding labels, 320px layouts, Pongal 15 January 2026 and Deepavali 8 November 2026. Zero page/console errors in the full and destination suites.
- All 70 assets are sharp WebP images with original-generation provenance in `artwork.json`; the 36-scene contact sheet was visually inspected. No supplied design-kit asset is served.
- 45 sourced calendar records. Tamil Nadu annual schedule transcribed from Gazette 721 / G.O. 708; statewide polling holiday 23 April 2026 from Gazette 208 / G.O. 239. Bank-only annual closing is not a general day off; constituency-only polling closures are not extrapolated to the state.
- Chosen reminder time exports as a timed event on the opening date. Provider opening time and verification remain separate; legacy plans retain timed/all-day behavior. Two added Node tests cover chosen-time exports and unknown provider time.
- Ruff format/lint, ty, pytest, Prettier, asset checks, uv audit and npm audit passed. Native calendar imports and actual device notifications still need physical-device checks.
