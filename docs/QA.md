# Verification — 11 October 2026

## Regional festival and date-control corrections

- 52 pytest and 19 Node tests pass, with symbol mapping and state-association publication assertions. Approved dates, sources, original records and all 34 artwork assets remain intact.
- The new regional browser suite verifies Tamil Nadu Ayutha Pooja without the central Durga Puja entry, faith-specific calendar markers, one leading Travel Date calendar icon, working leading-icon/chevron pickers, state-filtered travel insights and 320/390/1280 layouts. Six existing browser suites also passed on the regional Cloudflare preview.
- The publisher emits manifest schema 2 with festival associations derived from reviewed official state records. Known associations persist across year changes. Central guide entries without a verified association to the selected state are hidden; empty regional coverage remains explicitly incomplete.
- Calendar, Home upcoming festivals and travel insights share the same filter. The SVG symbols use the existing theme and inherit selected-day colors.

## Executed checks

- 52 pytest tests pass, including date arithmetic, leap years, calendar-month clipping, year boundaries, past dates, timezone boundaries, fixed/recurring rules, invalid input, standard rail and originating-station Tatkal behavior, five artwork/font/offline-shell regressions and three festival data/source regressions.
- The pytest run executes 13 Node calendar export/category/destination/festival tests. An independent `icalendar` parser accepts the generated timed and all-day ICS files, Unicode Tamil text, escaped locations and multiple alarms. Tests assert CRLF and the 75-octet folding limit.
- Ruff formatting/lint, ty, JavaScript syntax and Prettier checks pass. Python and npm audits report no known vulnerabilities in the resolved dependencies.
- Asset/data checks verify all 106 newly generated WebP images, vector symbols, the locally licensed font, all 36 jurisdictions, PWA brand assets, 93 public-calendar records and 65 yearly festival observances with 34 artwork themes. No obsolete `/assets/` reference remains in the app shell.
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


## Illustrated festivals update

- All 34 newly generated festival images were packaged as 1280px WebP and visually reviewed in a contact sheet. The Home and calendar captures were reviewed for matching style and readable dates. Prompts are in `artwork.json`; source scope and maintenance are in `FESTIVALS.md`.
- 65 reviewed observance dates cover 34 themes in 2026 and 31 in 2027. Public-calendar records remain separate (45). Node/Python regressions verify changing Diwali/Holi dates, local Pongal/Bakrid/Vishu/Vijayadashami precedence, main festival-family days, source links and absence of invented future dates or state leave.
- The new `tests/festivals-regression.js` passed locally: matching Home image/date, exact-date navigation, 34-title geometry at 320/360/390/430/1280 widths with no title/date/arrow overlap, illustrated annual guide, 2027 Holi/Diwali navigation, unknown-year messaging, layer toggles, year crossover and all 34 images available offline. Zero browser errors.
- Full app, themed controls, all-state destinations and carousel browser suites passed locally. Saved plans, calendar exports, all 14 forms, required reminder time, first installation and offline behavior remain covered.
- 38 pytest tests and 13 Node tests pass. Ruff format/lint, ty, JS syntax, Prettier, asset checks, uv audit and npm audit pass. No dependency changes were needed.


## Holiday pipeline and mobile corrections

- 52 Python tests and 18 Node tests pass. Tests use real archived 2024/2025 official PDFs without network calls; they cover parsing/year/weekdays, wrapped cells, bank scope, document hashes, conflicts, exact candidate review, idempotency, missing sources, coverage sufficiency, deterministic/checksummed publication, mixed jurisdictions, tentative/school/district exclusions, the browser fetch receiver and year/state loading. The original 45 reviewed records remain intact; 48 historical Tamil Nadu records were added.
- All six browser suites passed locally: full app, controls, destinations, carousel, festivals and holiday UI. The new suite checks all 36 state names at 320/360/390/430/1280 widths, Next Booking geometry, decoded-image node reuse, historical Pongal, festival lamp markers, stale-year response protection, offline data/icon availability and the exact Google template title/date/time/details. Zero page or console errors.
- Three generated saved thumbnails and the white vector-derived install icon were visually inspected. Calendar imagery remains visible in both detail and guide rows. The app preserves route forms, 14 booking categories, device-local plans and ICS exports.
- Annual files retain the original public JSON membership and classifications; local observances are filtered by jurisdiction. Coverage remains incomplete outside the reviewed scopes. Calendar-based demand is not pricing and does not imply leave.
- Live source checks are optional network integration checks, distinct from the offline test suite. Unsupported adapters and inaccessible sources are reported without dropping approved data. Scanned 2024 NIC evidence was not OCR-derived; the original Gazette was fetched and reviewed instead.
- Actual Google Calendar saving in a signed-in account, native mobile app handling and refresh of previously installed OS shortcuts require physical-device verification. Browser checks validate the complete generated template link and ICS fields; they do not claim an external event was saved.

### Final Cloudflare review verification

All six suites passed against [the holiday pipeline preview](https://holiday-pipeline-ui-bookday.vigneshshanmugam.workers.dev), immutable deployment `eef68bbe`, after the browser-loader and first-visit cache corrections: `ui-regression.js`, `controls-regression.js`, `destination-regression.js`, `carousel-regression.js`, `festivals-regression.js` and `holiday-ui-regression.js`. These runs verify real deployed calculations, all 34 festival images offline, cached annual data before service-worker control, five mobile/desktop widths, image node identity and complete Google event parameters. Festival artwork metadata checks now use the annual manifest rather than the transitional bulk export.

The final local gate also passed: 52 pytest, 18 Node, Ruff format/lint, ty, Prettier, approved-data validation, asset checks and Python/npm vulnerability audits. Cloudflare dry-run and branch-preview publication succeeded. Production was not changed by this update.

## Unattended all-state holiday release

- 76 Python tests and 24 Node tests passed. New coverage includes all 36 official aliases, independent state/year imports, missing-source preservation, pagination and civil-date checks, restricted/bank/regional scope, main-festival days, year-specific regional associations, live checksums, offline caching and atomic publication against a temporary Git remote.
- The collector backfilled available 2024/2025 data, validated 2026 records for all 36 jurisdictions, and retained published central dates through 2027. The generated release has 2,267 public-calendar records and 129 main-festival observances. Missing or invalid source data is retained and retried automatically.
- All nine browser suites passed against the Cloudflare `automatic-holidays` preview: app, controls, carousel, destinations, festivals, holiday UI, regional festivals, icons/current-date defaults and automatic holiday delivery. The latter verifies Today beside All, past/future month jumps, live delivery, all 36 dataset entries, representative state/UT dates, 320/390/1280 layouts and cached live dates offline. Artwork and responsive captures were inspected.
- Ruff formatting/lint, ty, Prettier, data/asset validation and Python/npm audits passed. The daily workflow publishes validated data to `holiday-data` without an approval environment or Cloudflare secret; immutable annual files support old cached manifests.

## Annual official-source cache and reminder banners

- The previous interrupted work was completed first: PR #5 merged as `794d162`, production deployed as `111935cb`, all nine production browser suites passed, and the first unattended main update/publish run `38155040352` succeeded.
- 83 Python tests and 24 Node tests passed. New regressions cover annual cache checksums, year isolation, freshness policy, network reuse, India Post's data-only parser, circle association and postal scope, official-source precedence, nested Andaman names, repeated-run stability, malformed caches and persisted cache publication/restoration.
- All ten browser suites passed on the preview. The added suite checks fourteen dedicated banners at 390/1280 widths, image loading/aspect ratios, title/subtitle geometry, current India date defaults, mandatory time, current-year-first descending history and future-year/Today navigation. The final source snapshot was rechecked with six relevant suites, including region names, all banners, Google Calendar parameters and icon/date regressions.
- The thirteen new generated panoramas were visually inspected together and in mobile reminder screens. They are packaged as WebP, with prompts and saved paths in `artwork.json`. The train illustration remains established artwork.
- Ruff format/lint, ty, Prettier, data/asset validation, Python/npm vulnerability audits and the GitHub quality workflow passed. The release has 2,267 public-calendar records and 405 festival observances/guides; postal guides do not establish state public leave.
- Preview: `da25d2cb-d10e-4606-8cf3-cf8c6ec4dea4`. Production merge, deployment and final live checks are recorded in [PR #6](https://github.com/Vignesh-S-GitHub/BookDay/pull/6).

### Production verification

PR #6 merged as `8f816a7` and deployed as `675f71eb-77c9-4697-a4ff-72334b6dff63`. All ten production browser suites passed. The main unattended update/publish run `38157906048` succeeded and published dual-source manifest `623835804805b7ee15b7`; both portal and India Post annual caches were confirmed on the delivery branch. Production health returned `ok` and a fresh browser cached both official sources.

Automatic delivery, regional/faith symbols, historical/offline dates and Google Calendar template parameters were rechecked after that publication. The holiday UI regression now accepts a nonempty selected-year guide rather than a fixed total of 17 festivals: the official dual-source list can grow without changing the selected-year, stale-response, date or scope assertions. Current visual QA captures remain locally; 113 obsolete probe files and 50 old QA scratch artifacts were removed.
