import {
  googleCalendarUrl,
  createICS,
  bookingSummary,
} from "./calendar-export.js";

const $ = (selector) => document.querySelector(selector);
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const dateObj = (value) => new Date(value + "T00:00:00Z");
const iso = (value) => value.toISOString().slice(0, 10);
const shift = (value, n) =>
  iso(new Date(dateObj(value).getTime() + n * 86400000));
const formatDate = (value) =>
  value
    ? new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        weekday: "short",
        timeZone: "UTC",
      }).format(dateObj(value))
    : "Not announced";
const icon = (name) => `<img src="/assets/icons/${name}.svg" alt="">`;
let toastTimer;
function toast(message) {
  $("#toast").textContent = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("#toast").textContent = ""), 6000);
}
function readStore(key, fallback, valid) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const value = JSON.parse(raw);
    if (!valid(value)) throw Error();
    return value;
  } catch {
    queueMicrotask(() =>
      toast(
        "Some device data could not be read. Defaults are shown; you can still use the planner.",
      ),
    );
    return fallback;
  }
}
function persist(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    toast(
      "Device storage is unavailable or full. Export your plan to a calendar to keep it.",
    );
    return false;
  }
}
const defaults = {
  version: 1,
  state: "Tamil Nadu",
  district: "",
  dark: false,
  layers: {
    holidays: true,
    festivals: true,
    weekends: true,
    bookings: true,
    demand: false,
  },
  hidden: [],
  offsets: [0],
};
let settings = readStore(
  "bookday.settings.v1",
  defaults,
  (v) =>
    v?.version === 1 &&
    typeof v.state === "string" &&
    Array.isArray(v.hidden) &&
    Array.isArray(v.offsets),
);
settings = {
  ...defaults,
  ...settings,
  layers: { ...defaults.layers, ...settings.layers },
  hidden: settings.hidden.filter((v) => typeof v === "string"),
  offsets: settings.offsets.filter(
    (v) => Number.isInteger(v) && v >= 0 && v <= 525600,
  ),
};
const validDate = (v) =>
  typeof v === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  Number.isFinite(dateObj(v).getTime()) &&
  iso(dateObj(v)) === v;
const validPlan = (p) =>
  p &&
  /^[a-zA-Z0-9-]{1,80}$/.test(p.id) &&
  typeof p.category === "string" &&
  validDate(p.event_date) &&
  p.result &&
  (p.result.opening_date === null || validDate(p.result.opening_date)) &&
  (!p.result.opening_time ||
    /^([01]\d|2[0-3]):[0-5]\d$/.test(p.result.opening_time));
let storage = readStore(
  "bookday.plans.v1",
  { version: 1, plans: [] },
  (v) =>
    v?.version === 1 &&
    Array.isArray(v.plans) &&
    v.plans.length <= 500 &&
    v.plans.every(validPlan),
);
let plans = storage.plans;
let catalog,
  holidays,
  currentPlan = null,
  pendingPlan = null,
  calendarPlan = null,
  editPlan = null;
let savedTab = "upcoming",
  query = "",
  month = today().slice(0, 7),
  selected = today(),
  overlay = "";
let installPrompt = null,
  registration = null;
const layerLabels = {
  holidays: "Public holidays",
  festivals: "Festivals",
  weekends: "Long weekends",
  bookings: "Booking openings",
  demand: "Demand signals",
};
function stateOptions(value) {
  return catalog.states
    .map(
      (state) =>
        `<option ${state === value ? "selected" : ""}>${esc(state)}</option>`,
    )
    .join("");
}
function applySettings() {
  document.documentElement.classList.toggle("dark", !!settings.dark);
  $("#home-state").innerHTML = stateOptions(settings.state);
}
function saveSettings() {
  persist("bookday.settings.v1", settings);
  applySettings();
}
function categoryFor(id) {
  return catalog.categories.find((c) => c.id === id);
}
function hero(image, title, subtitle = "") {
  return `<section class="bd-hero"><img src="/assets/banners/${image}.svg" alt="Illustrated Indian scenery"><div class="bd-hero-content"><h1>${title}</h1>${subtitle ? `<p>${subtitle}</p>` : ""}</div></section>`;
}
function intro(title, sub) {
  return `<div class="page-intro"><h1>${title}</h1><p>${sub}</p></div>`;
}
function categoryCards(categories, quick = false) {
  return `<div class="category-grid ${quick ? "quick" : ""}">${categories.map((c) => `<a class="category" href="#/book/${c.id}" aria-label="${esc(c.label)} booking planner"><img src="/assets/categories/${c.id}.svg" alt=""><span>${esc(c.label)}</span></a>`).join("")}</div>`;
}
function searchBox() {
  return `<form class="search" id="search-form">${icon("search")}<input type="search" id="search-input" aria-label="Search categories and services" placeholder="Search trains, flights, hotels…" value="${esc(query)}"><button class="bd-primary" aria-label="Search">${icon("search")}</button></form>`;
}
function recordsFor(state = settings.state) {
  return holidays.records.filter(
    (h) => h.jurisdictions.includes("IN") || h.jurisdictions.includes(state),
  );
}
function publicRecords(state) {
  return recordsFor(state).filter(
    (h) =>
      h.status === "official" &&
      ["national_public", "state_public"].includes(h.type),
  );
}
function weekendBlocks(state = settings.state) {
  const days = new Set(publicRecords(state).map((h) => h.date)),
    blocks = new Map();
  const off = (d) =>
    days.has(d) || dateObj(d).getUTCDay() === 0 || dateObj(d).getUTCDay() === 6;
  for (const day of days) {
    let start = day,
      end = day;
    while (off(shift(start, -1))) start = shift(start, -1);
    while (off(shift(end, 1))) end = shift(end, 1);
    if ((dateObj(end) - dateObj(start)) / 86400000 >= 2) {
      let block = [];
      for (let d = start; d <= end; d = shift(d, 1)) block.push(d);
      if (block.some((d) => [0, 6].includes(dateObj(d).getUTCDay())))
        blocks.set(start, block);
    }
  }
  return [...blocks.values()];
}
function signal(day, state = settings.state) {
  const rows = recordsFor(state).filter(
      (h) =>
        h.status === "official" &&
        h.type !== "bank_holiday" &&
        Math.abs((dateObj(h.date) - dateObj(day)) / 86400000) <= 1,
    ),
    weekend = [0, 6].includes(dateObj(day).getUTCDay());
  return {
    label: rows.length ? "High" : weekend ? "Moderate" : "Insufficient data",
    score: rows.length ? 2 : weekend ? 1 : 0,
    reasons: [...rows.map((h) => h.name), ...(weekend ? ["Weekend"] : [])],
  };
}
function status(plan) {
  const r = plan.result;
  if (!r.opening_date) return "Not Announced";
  if (
    r.opening_date < today() ||
    (r.opening_at && Date.parse(r.opening_at) < Date.now())
  )
    return "Already Opened";
  return r.opening_date === today() ? "Opens Today" : "Upcoming";
}
function countdown(plan) {
  const r = plan.result;
  if (!r.opening_date) return "Waiting for announcement";
  if (status(plan) === "Already Opened") return "Opening date has passed";
  if (!r.opening_at) {
    const days = Math.round(
      (dateObj(r.opening_date) - dateObj(today())) / 86400000,
    );
    return days === 0
      ? "Opens today · time unknown"
      : `${days} days until opening date · time unknown`;
  }
  const seconds = Math.max(
    0,
    Math.floor((Date.parse(r.opening_at) - Date.now()) / 1000),
  );
  return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h ${Math.floor((seconds % 3600) / 60)}m ${seconds % 60}s until opening`;
}
function coverage() {
  return `<p class="hint">${esc(holidays.coverage)}</p>`;
}
function home() {
  const cats = catalog.categories.filter(
    (c) => !settings.hidden.includes(c.id),
  );
  const next = recordsFor()
    .filter(
      (h) =>
        h.date >= today() &&
        h.status === "official" &&
        ((h.festival && settings.layers.festivals) ||
          (["national_public", "state_public"].includes(h.type) &&
            settings.layers.holidays)),
    )
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  const nearest = plans
    .filter((p) => p.result.opening_date && status(p) !== "Already Opened")
    .sort((a, b) =>
      a.result.opening_date.localeCompare(b.result.opening_date),
    )[0];
  return `${hero("home_india", "Plan Today,<br><span>Book Smarter</span>", "Know When to Book.")}${searchBox()}${categoryCards(["trains", "flights", "buses", "hotels", "movies", "temples", "events", "tourism"].map((id) => cats.find((c) => c.id === id)).filter(Boolean), true)}<div class="section-heading"><h2>Your next plans</h2><a href="#/explore">Explore all →</a></div><div class="two-up"><a href="#/calendar" class="card banner-card"><img src="/assets/banners/india_festivals.svg" alt=""><small>Next verified calendar event</small><h3>${next ? esc(next.name) : "Holiday coverage is growing"}</h3><p>${next ? formatDate(next.date) : "See available official records"}</p></a><div class="card"><span class="badge">Next saved opening</span><h3>${nearest ? esc(nearest.title) : "Make room for a plan"}</h3><p>${nearest ? formatDate(nearest.result.opening_date) : "Find an opening date and keep it on this device."}</p><a class="bd-primary full" href="${nearest ? "#/detail/" + nearest.id : "#/explore"}">${nearest ? "View plan" : "Start planning"}</a></div></div><a class="card banner-card" href="#/insights"><h2>Find your next getaway</h2><p>Explore verified holidays and calendar demand signals.</p><img src="/assets/banners/kerala_backwaters.svg" alt="Illustrated Kerala backwaters"><span>Travel insights →</span></a>${coverage()}`;
}
function explore() {
  const cats = catalog.categories.filter((c) =>
    (c.label + " " + c.description).toLowerCase().includes(query.toLowerCase()),
  );
  return (
    intro("Explore", "All your bookings and more, in one place.") +
    searchBox() +
    categoryCards(cats) +
    (cats.length
      ? ""
      : '<div class="card empty">No matching categories. Try another search.</div>')
  );
}
function field(label, name, type, value = "", extra = "") {
  return `<label>${label}<input class="bd-input" name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
}
function calculator(id) {
  const c = categoryFor(id);
  if (!c)
    return intro("Category unavailable", "Choose a category from Explore.");
  const p = editPlan?.category === id ? editPlan : null;
  return `<a class="back-link" href="#/explore">${icon("back")}Explore</a>${hero(id === "trains" ? "train_journey" : id === "temples" ? "temple_darshan" : id === "hotels" ? "hotel_stay" : "home_india", `${esc(c.label)} <span>Booking</span>`, "Calculate an opening date and keep your plan.")}<div class="calculator-layout"><form id="booking-form" class="card" hx-post="/fragments/calculate" hx-target="#server-result" hx-params="event_date,mode,amount,opening_time,fixed_date,origin_date,train_class,category" hx-request='{"timeout":15000}'><input type="hidden" name="category" value="${id}"><div class="fields">${field("Journey / event date", "event_date", "date", p?.event_date || shift(today(), 60), 'required min="1900-01-01" max="2100-12-31"')}<label>Booking rule<select class="bd-input" name="mode" id="rule-mode">${[["days", "N days before"], ["months", "N calendar months before"], ["fixed", "Fixed announced date"], ["weekly", "Recurring weekly"], ["monthly", "Recurring monthly"], ["unknown", "Not announced yet"], ...(id === "trains" ? [["tatkal", "Tatkal — origin departure date"]] : [])].map(([value, label]) => `<option value="${value}" ${value === (p?.mode || c.default_mode) ? "selected" : ""}>${label}</option>`).join("")}</select></label><div data-field="amount">${field("Days / months / recurring day", "amount", "number", p?.amount ?? (id === "trains" ? catalog.rail.advance_days : 30), 'min="0" max="3650" step="1"')}<p id="amount-help" class="hint"></p></div><div data-field="fixed_date">${field("Announced opening date", "fixed_date", "date", p?.fixed_date || "", 'min="1900-01-01" max="2100-12-31"')}</div><div data-field="opening_time">${field("Opening time (optional, IST)", "opening_time", "time", p?.opening_time || "")}<p class="hint">Leave blank if unknown. Calendar exports will use an all-day reminder.</p></div><div data-field="origin_date">${field("Train departure date at originating station", "origin_date", "date", p?.origin_date || "", 'min="1900-01-01" max="2100-12-31"')}</div><div data-field="train_class"><label>Tatkal class<select class="bd-input" name="train_class"><option value="ac">AC · 10:00 IST</option><option value="non-ac" ${p?.train_class === "non-ac" ? "selected" : ""}>Non-AC · 11:00 IST</option></select></label></div>${field("Plan title (optional)", "title", "text", p?.title || "", 'maxlength="120" placeholder="Chennai → Madurai"')}${field("Service / operator note (optional)", "service", "text", p?.service || "", 'maxlength="180"')}${field("Origin / location (optional)", "origin", "text", p?.origin || "", 'maxlength="100"')}${field("Destination (optional)", "destination", "text", p?.destination || "", 'maxlength="100"')}</div><p class="hint">${id === "trains" ? esc(catalog.rail.warning) : "No standard release window is assumed for this category. Use an announced date or your own rule; confirm it with the provider."}</p><button class="bd-primary full" type="submit">Find Booking Date →</button><p class="hint">Your title and route stay on this device. Only calculation dates, rule and category are sent to BookDay.</p><div id="server-result" aria-live="polite"></div></form><aside class="card"><img class="result-art" src="/assets/categories/${id}.svg" alt=""><h2>${id === "trains" ? "Indian Railways advance booking" : "Your rule, your plan"}</h2><p>${id === "trains" ? `Standard advance window: <strong>${catalog.rail.advance_days} days</strong>, excluding the travel date.` : "Choose a known announcement date or calculate an opening using days, months, or a recurring provider rule."}</p><p>Recurring rules find the latest matching opening on or before the event. Month dates clip to the last valid day.</p>${id === "trains" ? `<a href="${catalog.rail.source}" target="_blank" rel="noopener">Advance policy source ↗</a><p><a href="${catalog.rail.tatkal_source}" target="_blank" rel="noopener">Tatkal policy source ↗</a></p>` : ""}<p class="hint">Dates indicate when a booking window opens. They do not indicate availability.</p></aside></div>`;
}
function updateRuleFields() {
  const form = $("#booking-form");
  if (!form) return;
  const mode = form.elements.mode.value;
  for (const box of form.querySelectorAll("[data-field]")) {
    const key = box.dataset.field;
    const active =
      key === "amount"
        ? ["days", "months", "weekly", "monthly"].includes(mode)
        : key === "fixed_date"
          ? mode === "fixed"
          : key === "opening_time"
            ? !["unknown", "tatkal"].includes(mode)
            : mode === "tatkal";
    box.hidden = !active;
    for (const input of box.querySelectorAll("input,select")) {
      input.disabled = !active;
      input.required = active && ["fixed_date", "origin_date"].includes(key);
    }
  }
  const amount = form.elements.amount;
  amount.min = mode === "monthly" ? "1" : "0";
  amount.max =
    mode === "weekly"
      ? "6"
      : mode === "monthly"
        ? "31"
        : mode === "months"
          ? "1200"
          : "3650";
  $("#amount-help").textContent =
    mode === "weekly"
      ? "Weekday: Monday = 0, Tuesday = 1, … Sunday = 6."
      : mode === "monthly"
        ? "Day of month: 1–31; shorter months clip to their final day."
        : "";
}
function collectPlan() {
  const form = $("#booking-form");
  const raw = Object.fromEntries(new FormData(form));
  return {
    ...raw,
    amount: Number(raw.amount ?? 60),
    id: editPlan?.id || crypto.randomUUID(),
    categoryLabel: categoryFor(raw.category).label,
    title: raw.title || `${categoryFor(raw.category).label} booking opens`,
    offsets: editPlan?.offsets || [...settings.offsets],
    completed: editPlan?.completed || false,
  };
}
function planActions(p, withSave = true) {
  const known = !!p.result.opening_date;
  return `<div class="actions">${withSave ? `<button class="bd-primary" data-action="save" data-id="${p.id}">Save plan</button>` : ""}<button class="bd-primary" data-action="calendar" data-id="${p.id}" ${known ? "" : "disabled"}>Add to Calendar</button></div><div class="actions"><button class="bd-secondary" data-action="download" data-id="${p.id}" ${known ? "" : "disabled"}>Download .ics</button><button class="bd-secondary" data-action="share" data-id="${p.id}">Share Booking</button></div>`;
}
function resultPage(p) {
  const r = p.result;
  return `<a class="back-link" data-action="edit" data-id="${p.id}" href="#/book/${p.category}">${icon("back")}Adjust booking rule</a><section class="card result"><img class="result-art" src="/assets/brand/bookday_icon_only.png" alt=""><h1>Your booking plan</h1><p>${esc(p.title)}</p><span class="badge">${status(p)}</span><span class="badge orange">${esc(r.verification_status || "Rule Unverified")}</span><h2>Booking opens on</h2><div class="opening-date">${formatDate(r.opening_date)}</div><div class="result-facts"><div class="fact"><small>Journey / event date</small><strong>${formatDate(p.event_date)}</strong></div><div class="fact"><small>Opening time · Asia/Kolkata</small><strong>${r.opening_time ? esc(r.opening_time) + " IST" : "Unknown · all-day reminder"}</strong></div></div><p>${esc(r.rule)}</p><p class="countdown" data-countdown="${p.id}">${countdown(p)}</p><p class="hint">${r.opening_date ? "The opening date is separate from ticket or slot availability. Confirm service exceptions with the provider." : "Add the release date when it is announced. Calendar exports are available after an opening date is known."}</p>${p.source ? `<p><a href="${esc(p.source)}" target="_blank" rel="noopener">Verified policy source ↗</a></p>` : ""}${planActions(p)}<div class="actions"><button class="bd-secondary" data-action="edit" data-id="${p.id}">Edit plan</button>${categoryFor(p.category).provider_url ? `<a class="bd-secondary" target="_blank" rel="noopener" href="${categoryFor(p.category).provider_url}">Official booking site ↗</a>` : ""}</div><p class="hint">Exported calendars are managed by their calendar app. BookDay does not send background notifications.</p></section>`;
}
function saved() {
  const list = plans
    .filter((p) =>
      savedTab === "completed"
        ? p.completed || p.event_date < today()
        : !p.completed && p.event_date >= today(),
    )
    .sort((a, b) =>
      (a.result.opening_date || "9999").localeCompare(
        b.result.opening_date || "9999",
      ),
    );
  return (
    intro("Saved", "Your bookings and plans, kept on this device.") +
    `<div class="tabs"><button data-tab="upcoming" class="${savedTab === "upcoming" ? "active" : ""}">Upcoming</button><button data-tab="completed" class="${savedTab === "completed" ? "active" : ""}">Completed</button></div><p class="hint">Plans move to Completed after the event date or when you mark them complete. Opening dates may already have passed.</p><div class="saved-grid">${list.map((p) => `<article class="card saved-card"><img src="/assets/categories/${p.category}.svg" alt=""><div><a href="#/detail/${p.id}"><h3>${esc(p.title)}</h3></a><small>${esc(p.categoryLabel)}</small><p>Opens ${formatDate(p.result.opening_date)}</p><span class="badge">${status(p)}</span><div class="countdown" data-countdown="${p.id}">${countdown(p)}</div></div>${planActions(p, false)}<div class="actions"><button class="bd-secondary" data-action="edit" data-id="${p.id}">Edit</button><button class="bd-secondary" data-action="complete" data-id="${p.id}">${p.completed ? "Reopen" : "Complete"}</button><button class="bd-secondary" data-action="delete" data-id="${p.id}">Delete</button></div></article>`).join("")}</div>${list.length ? "" : '<div class="card empty"><img src="/assets/categories/appointments.svg" alt=""><h2>No plans here yet</h2><p>Find an opening date, then save it to keep it here.</p></div>'}<a class="bd-primary full" href="#/explore">Create a booking plan +</a><p class="hint">Device storage can be cleared by your browser. Google Calendar and ICS exports let you keep a separate reminder.</p>`
  );
}
function calendar() {
  const d = dateObj(month + "-01"),
    year = d.getUTCFullYear(),
    m = d.getUTCMonth(),
    start = shift(month + "-01", -d.getUTCDay()),
    state = overlay || settings.state,
    blocks = weekendBlocks(state);
  const layers = settings.layers;
  const rows = recordsFor(state);
  let cells = "";
  for (let i = 0; i < 42; i++) {
    const day = shift(start, i),
      h = rows.filter((h) => h.date === day),
      opening = plans.filter((p) => p.result.opening_date === day);
    const marks =
      (layers.holidays &&
      h.some((h) => ["national_public", "state_public"].includes(h.type))
        ? "●"
        : "") +
      (layers.festivals && h.some((h) => h.festival) ? "◆" : "") +
      (layers.bookings && opening.length ? "●" : "") +
      (layers.demand && signal(day, state).score ? "·" : "");
    const long = layers.weekends && blocks.some((b) => b.includes(day));
    cells += `<button class="day ${day === selected ? "selected" : ""} ${day === today() ? "today" : ""} ${day.slice(0, 7) !== month ? "off" : ""} ${long ? "weekend" : ""}" data-day="${day}" aria-label="${formatDate(day)}${marks ? ", calendar signals" : ""}" aria-pressed="${day === selected}" ${day === today() ? 'aria-current="date"' : ""}>${dateObj(day).getUTCDate()}<span class="dots">${marks}</span></button>`;
  }
  const selectedRows = rows.filter(
    (h) =>
      h.date === selected &&
      ((layers.holidays &&
        ["national_public", "state_public"].includes(h.type)) ||
        (layers.festivals && h.festival) ||
        (h.type === "bank_holiday" && layers.holidays)),
  );
  const bookings = layers.bookings
    ? plans.filter((p) => p.result.opening_date === selected)
    : [];
  const block = layers.weekends
    ? blocks.find((b) => b.includes(selected))
    : null;
  const demand = signal(selected, state);
  return `${hero("temple_darshan", "India Calendar", "Holidays · festivals · booking openings")}<div class="chips"><button class="chip" data-layer="all" aria-pressed="${Object.values(layers).every(Boolean)}">All</button>${Object.entries(
    layerLabels,
  )
    .map(
      ([key, label]) =>
        `<button class="chip" data-layer="${key}" aria-pressed="${layers[key]}">${label}</button>`,
    )
    .join(
      "",
    )}</div><label>Destination overlay (optional)<select id="overlay" class="bd-input"><option value="">Home: ${esc(settings.state)}</option>${stateOptions(overlay)}</select></label><div class="calendar-layout"><section class="card"><div class="month-controls"><button class="icon-button" data-month="-1" aria-label="Previous month">‹</button><select id="month-select" aria-label="Month">${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}" ${i === m ? "selected" : ""}>${new Intl.DateTimeFormat("en-IN", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(year, i, 1)))}</option>`).join("")}</select><select id="year-select" aria-label="Year">${Array.from({ length: 201 }, (_, i) => `<option ${1900 + i === year ? "selected" : ""}>${1900 + i}</option>`).join("")}</select><button class="icon-button" data-month="1" aria-label="Next month">›</button></div><div class="date-grid">${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((w) => `<span class="weekday">${w}</span>`).join("")}${cells}</div><button class="bd-secondary full" id="calendar-today">Today</button><p class="hint">● Public holiday / saved opening · ◆ Festival · pale amber: derived long weekend.</p></section><section class="card detail-list"><div><small>${formatDate(selected)}</small><h2>${esc(state)}</h2></div>${selectedRows.map((h) => `<article><h3>${esc(h.name)}</h3><span class="badge">${esc(h.type.replaceAll("_", " "))}</span><span class="badge green">${esc(h.status)}</span><p>${esc(h.note)}</p><small>Reviewed ${h.reviewed} · ${esc(h.jurisdictions.join(", "))}</small><p><a href="${esc(h.source)}" target="_blank" rel="noopener">Official source ↗</a></p></article>`).join("")}${bookings.map((p) => `<a href="#/detail/${p.id}"><h3>${esc(p.title)}</h3><p>Booking opens ${p.result.opening_time || "time unknown"} →</p></a>`).join("")}${block ? `<div><span class="badge orange">${block.length} day long weekend</span><p>${formatDate(block[0])} – ${formatDate(block.at(-1))}. Assumes Saturday and Sunday off; check your employer schedule.</p></div>` : ""}${layers.demand ? `<div><h3>${demand.label} expected demand</h3><p>${esc(demand.reasons.join(", ") || "No verified local data for this date.")}.</p><small>Calendar heuristic; no price or availability prediction.</small></div>` : ""}${selectedRows.length || bookings.length ? "" : "<p>No matching verified records or saved openings for this date. This does not mean the date is a working day.</p>"}</section></div>${coverage()}`;
}
function insights() {
  return (
    hero(
      "kerala_backwaters",
      "Travel <span>Insights</span>",
      "Plan around known dates, with the reasons in view.",
    ) +
    `<form id="insights-form" class="card"><div class="fields"><label>Destination state / UT<select class="bd-input" name="state">${stateOptions(overlay || settings.state)}</select></label>${field("Travel date", "date", "date", selected, 'required min="1900-01-01" max="2100-12-31"')}${field("Stay duration (days)", "duration", "number", "3", 'min="1" max="30" required')}</div><button class="bd-primary full">Explore calendar signals</button></form><div id="insights-result" aria-live="polite"></div>${coverage()}`
  );
}
function renderInsights(form) {
  const data = Object.fromEntries(new FormData(form)),
    duration = Number(data.duration),
    dates = Array.from({ length: duration }, (_, i) => shift(data.date, i)),
    signals = dates.map((day) => signal(day, data.state)),
    score = Math.max(...signals.map((s) => s.score));
  const reasons = [...new Set(signals.flatMap((s) => s.reasons))];
  const nearby = recordsFor(data.state).filter(
    (h) =>
      h.status === "official" &&
      h.date >= shift(data.date, -3) &&
      h.date <= shift(data.date, duration + 2),
  );
  const blocks = weekendBlocks(data.state).filter(
    (b) => b.at(-1) >= data.date && b[0] <= shift(data.date, duration - 1),
  );
  const alternatives = [];
  for (let offset = -7; offset <= 7; offset++) {
    const day = shift(data.date, offset);
    if (day < today() || offset === 0) continue;
    const rank = Math.max(
      ...Array.from(
        { length: duration },
        (_, i) => signal(shift(day, i), data.state).score,
      ),
    );
    if (rank < score) alternatives.push(day);
  }
  $("#insights-result").innerHTML =
    `<h2>Your travel insights</h2><div class="two-up"><div class="card"><span class="badge ${score === 2 ? "orange" : ""}">${score === 2 ? "High" : score === 1 ? "Moderate" : "Insufficient data"} expected demand</span><p>${esc(reasons.join(", ") || "No verified destination events in this curated dataset.")}.</p></div><div class="card"><h3>Nearby verified dates</h3>${nearby.map((h) => `<p>${esc(h.name)}<br><small>${formatDate(h.date)}</small></p>`).join("") || "<p>No verified nearby records.</p>"}</div><div class="card"><h3>Long weekends</h3>${blocks.map((b) => `<p>${formatDate(b[0])} – ${formatDate(b.at(-1))}</p>`).join("") || "<p>No derived long weekend during this stay.</p>"}</div><div class="card"><h3>Fewer known signals</h3>${
      alternatives
        .slice(0, 3)
        .map((d) => `<p>${formatDate(d)}</p>`)
        .join("") || "<p>No lower-signal dates found in the adjacent week.</p>"
    }</div></div><p class="hint">These estimates use weekends and verified calendar records. Missing coverage prevents a reliable Low label. Alternative dates have fewer known signals; they are not verified cheaper dates. Long weekends assume Saturday and Sunday off.</p><a class="bd-primary full" href="#/book/hotels">Plan a stay →</a>`;
}
function more() {
  const toggle = (key, label, sub, ico) =>
    `<label class="settings-row"><div>${icon(ico)}<span><strong>${label}</strong><small>${sub}</small></span></div><input type="checkbox" data-setting="${key}" ${key === "dark" ? (settings.dark ? "checked" : "") : settings.layers[key] ? "checked" : ""}></label>`;
  return (
    intro("Settings", "Make BookDay work for your plans.") +
    `<div class="settings-list"><label class="settings-row"><span><strong>Home state / UT</strong><small>Choose from all 36 jurisdictions</small></span><select id="settings-state" class="bd-input">${stateOptions(settings.state)}</select></label><label class="settings-row"><span><strong>District (optional)</strong><small>Stored locally; district records not available yet</small></span><input id="district" class="bd-input" maxlength="80" value="${esc(settings.district)}"></label><div class="settings-row"><span><strong>Language</strong><small>Complete V1 interface</small></span><strong>English</strong></div>${Object.entries(
      layerLabels,
    )
      .map(([key, label]) =>
        toggle(
          key,
          "Show " + label.toLowerCase(),
          "Affects calendar layers",
          key === "bookings"
            ? "clock"
            : key === "demand"
              ? "demand"
              : key === "weekends"
                ? "long_weekend"
                : key,
        ),
      )
      .join(
        "",
      )}${toggle("dark", "Dark mode", "Use a darker canvas", "moon")}<details><summary>Reminder defaults</summary><p class="hint">For ICS exports only. Google Calendar uses its own notification settings.</p>${offsetChecks(settings.offsets, "default-offset")}<label>Custom offset (minutes before)<input class="bd-input" id="default-custom" type="number" min="0" max="525600" value="${settings.offsets.find((n) => ![0, 60, 1440, 10080].includes(n)) ?? ""}"></label><button class="bd-primary full" id="save-offsets">Save reminder defaults</button></details><details><summary>Manage Home categories</summary>${catalog.categories.map((c) => `<label class="check-row"><input type="checkbox" data-category="${c.id}" ${settings.hidden.includes(c.id) ? "" : "checked"}>${esc(c.label)}</label>`).join("")}<p class="hint">All 14 categories remain available in Explore.</p></details><a class="settings-row" href="#/reminders"><strong>Calendar reminders help</strong>→</a><button class="bd-secondary full" id="install-app">Install BookDay</button><button class="bd-secondary full" id="update-app" ${registration?.waiting ? "" : "hidden"}>Apply available update</button><details><summary>About BookDay · 1.0</summary><img class="logo" src="/assets/brand/bookday_logo_horizontal.png" alt="BookDay"><p>Know When to Book. A date planning tool for booking openings, with official-source examples and calendar exports.</p>${coverage()}</details><details><summary>Privacy and device storage</summary><p>No account is required. Titles, routes, saved plans and settings stay in your browser. Calculation dates, rule parameters and category are sent to the BookDay API. Saving a plan does not send it to a server. Calendar and share actions send the selected plan to the destination you choose.</p><p>BookDay does not operate push, email or Telegram reminders. Google Fonts is loaded from Google; system fonts are used offline. Cloudflare processes web requests and operational logs, including request metadata. Form bodies are not logged by the app.</p><p>Use ICS or your calendar to retain reminders before clearing browser storage. Device data is not synced.</p></details><details><summary>Data and booking information</summary><p>Holiday coverage is incomplete. Festival, public holiday, bank, school and local-event records have different meanings. The app has no live availability or pricing integrations. Verify provider exceptions and your employer's holiday schedule.</p></details></div>`
  );
}
function offsetChecks(offsets, cls) {
  return [
    [0, "At opening"],
    [60, "1 hour before"],
    [1440, "1 day before"],
    [10080, "7 days before"],
  ]
    .map(
      ([value, label]) =>
        `<label class="check-row"><input class="${cls}" type="checkbox" value="${value}" ${offsets.includes(value) ? "checked" : ""}>${label}</label>`,
    )
    .join("");
}
function reminders() {
  return (
    intro(
      "Calendar reminders",
      "Enter your dates once. Save the completed reminder in your calendar.",
    ) +
    `<div class="card"><h2>Google Calendar</h2><p>BookDay opens a prefilled event editor for the booking opening. Review it and tap Save in Google Calendar. Google may ask you to sign in there.</p><p>Your calendar's default notifications apply. The link cannot set custom reminder offsets, force the native app to open, or tell BookDay whether you saved the event.</p><h2>Other Calendar Apps (.ics)</h2><p>Use the system share chooser if supported, or download the ICS file and import it into your calendar. Check the imported reminder settings; apps differ in how they handle alarms and duplicate imports.</p><h2>Unknown opening time</h2><p>BookDay creates an all-day opening-date event. At opening alarms for all-day ICS events are relative to the calendar's local midnight. Choose a time in your plan if you know it.</p><h2>Saved on this device</h2><p>Local plans do not send alerts after BookDay closes. Calendar apps deliver their own notifications after you save or import an event.</p><a class="bd-primary full" href="#/saved">Go to saved plans</a></div>`
  );
}
function render() {
  const parts = location.hash.replace(/^#\/?/, "").split("/"),
    route = parts[0] || "home";
  let html;
  if (route === "home") html = home();
  else if (route === "explore") html = explore();
  else if (route === "book") html = calculator(parts[1] || "custom");
  else if (route === "result" || route === "detail") {
    const p =
      route === "detail" ? plans.find((p) => p.id === parts[1]) : currentPlan;
    html = p
      ? resultPage(p)
      : intro(
          "Plan unavailable",
          "Return to Saved or create a new booking plan.",
        );
  } else if (route === "saved") html = saved();
  else if (route === "calendar") html = calendar();
  else if (route === "insights") html = insights();
  else if (route === "reminders") html = reminders();
  else html = more();
  $("#main").innerHTML = html;
  document.title = `${{ home: "Home", explore: "Explore", calendar: "India Calendar", saved: "Saved", book: "Booking Planner", result: "Booking Result", detail: "Booking Details", insights: "Travel Insights", reminders: "Calendar Reminders" }[route] || "Settings"} · BookDay`;
  for (const link of document.querySelectorAll(".bd-navitem")) {
    const active =
      link.hash === `#/${route}` ||
      (link.hash === "#/more" &&
        ["more", "reminders", "insights"].includes(route)) ||
      (link.hash === "#/explore" && ["book", "result"].includes(route)) ||
      (link.hash === "#/saved" && route === "detail");
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  window.htmx.process($("#main"));
  updateRuleFields();
}
function findPlan(id) {
  return currentPlan?.id === id ? currentPlan : plans.find((p) => p.id === id);
}
function savePlan(plan) {
  const next = plans.filter((p) => p.id !== plan.id).concat(plan);
  if (next.length > 500) {
    toast("Maximum 500 plans. Export and remove old plans first.");
    return;
  }
  if (persist("bookday.plans.v1", { version: 1, plans: next })) {
    plans = next;
    toast("Plan saved on this device. Export it to a calendar for reminders.");
  }
}
function openCalendar(p) {
  calendarPlan = p;
  $("#calendar-options").innerHTML =
    `<p><strong>${esc(p.title)}</strong><br>${formatDate(p.result.opening_date)} · ${p.result.opening_time ? esc(p.result.opening_time) + " IST" : "All-day · time unknown"}</p><a class="bd-primary full" id="google-calendar" href="${esc(googleCalendarUrl(p))}" target="_blank" rel="noopener">Google Calendar ↗</a><p class="hint">All supported fields are prefilled; tap Save there. Google Calendar uses its own notification settings, including when ICS offsets are selected below.</p><h3>Remind me (ICS)</h3>${offsetChecks(p.offsets || settings.offsets, "event-offset")}<label>Custom offset (minutes before)<input class="bd-input" id="event-custom" type="number" min="0" max="525600" value="${(p.offsets || settings.offsets).find((n) => ![0, 60, 1440, 10080].includes(n)) ?? ""}"></label><button class="bd-primary full" id="share-ics">Other Calendar Apps (.ics)</button><button class="bd-secondary full" id="download-ics">Download .ics</button><p class="hint">Your device chooses compatible apps. Imported alarm support varies; check your calendar after import. Re-importing may create duplicates in some clients. The UID stays consistent for this plan.</p>`;
  $("#calendar-dialog").showModal();
}
function selectedOffsets(cls, customId) {
  const values = [...document.querySelectorAll("." + cls + ":checked")].map(
    (el) => Number(el.value),
  );
  const custom = $("#" + customId);
  if (custom.value !== "") {
    if (!custom.reportValidity())
      throw Error("Choose a valid custom reminder offset.");
    values.push(Number(custom.value));
  }
  return [...new Set(values)];
}
function icsFile(p, offsets) {
  return new File(
    [createICS(p, offsets)],
    `bookday-${p.category}-${p.result.opening_date}.ics`,
    { type: "text/calendar;charset=utf-8" },
  );
}
function download(file) {
  const url = URL.createObjectURL(file),
    anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  toast(
    "ICS downloaded. Open it in your calendar, import, and check the alarms.",
  );
}
async function shareFile(p) {
  const offsets = selectedOffsets("event-offset", "event-custom");
  p.offsets = offsets;
  if (plans.some((plan) => plan.id === p.id)) savePlan(p);
  const file = icsFile(p, offsets);
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: p.title,
        text: "Import this booking opening in your calendar.",
      });
      toast(
        "Share sheet completed. The recipient still needs to import the event.",
      );
    } else download(file);
  } catch (error) {
    if (error.name === "AbortError")
      toast("Sharing canceled. You can still download the ICS file.");
    else {
      download(file);
    }
  }
}
async function sharePlan(p) {
  const text = p.result.opening_date
    ? bookingSummary(p)
    : `BookDay: ${p.title}\nEvent: ${p.event_date}\nOpening not announced.\nRule: ${p.result.rule}`;
  try {
    if (navigator.share) {
      await navigator.share({ title: p.title, text });
      toast("Share sheet completed.");
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      toast("Booking summary copied.");
    } else
      toast("Sharing unavailable. Use a calendar export to share this plan.");
  } catch (error) {
    toast(
      error.name === "AbortError"
        ? "Sharing canceled."
        : "Sharing unavailable. Try Download .ics.",
    );
  }
}

document.addEventListener(
  "submit",
  (event) => {
    if (event.target.id === "booking-form") {
      pendingPlan = collectPlan();
    } else if (event.target.id === "search-form") {
      event.preventDefault();
      query = $("#search-input").value;
      if (location.hash === "#/explore") render();
      else location.hash = "#/explore";
    } else if (event.target.id === "insights-form") {
      event.preventDefault();
      renderInsights(event.target);
    }
  },
  true,
);
document.addEventListener("htmx:configRequest", (event) => {
  for (const key of ["opening_time", "fixed_date", "origin_date"])
    if (!event.detail.parameters[key]) delete event.detail.parameters[key];
});
document.addEventListener("htmx:beforeSwap", (event) => {
  if (event.detail.xhr.status === 422) {
    event.detail.shouldSwap = true;
    event.detail.isError = false;
  }
});
document.addEventListener("htmx:afterSwap", (event) => {
  if (event.detail.target.id !== "server-result") return;
  const result = $("#server-result [data-result]");
  if (result && pendingPlan) {
    currentPlan = { ...pendingPlan, result: JSON.parse(result.dataset.result) };
    currentPlan.source = currentPlan.result.source || null;
    editPlan = null;
    location.hash = "#/result";
  }
});
document.addEventListener("htmx:sendError", () =>
  toast(
    "Calculation unavailable. Check your connection and try again. Saved plans and calendar exports work offline.",
  ),
);
document.addEventListener("htmx:timeout", () =>
  toast("Calculation took too long. Please try again."),
);
document.addEventListener("click", async (event) => {
  const el = event.target.closest("button,a");
  if (!el) return;
  try {
    if (el.dataset.action) {
      const p = findPlan(el.dataset.id);
      if (!p) return;
      switch (el.dataset.action) {
        case "save":
          savePlan(p);
          break;
        case "calendar":
          openCalendar(p);
          break;
        case "download":
          download(icsFile(p, p.offsets || settings.offsets));
          break;
        case "share":
          await sharePlan(p);
          break;
        case "edit":
          editPlan = p;
          location.hash = "#/book/" + p.category;
          break;
        case "complete":
          p.completed = !p.completed;
          savePlan(p);
          render();
          break;
        case "delete":
          if (
            confirm(
              "Delete this plan from this device? Calendar exports are managed separately.",
            )
          ) {
            const next = plans.filter((plan) => plan.id !== p.id);
            if (persist("bookday.plans.v1", { version: 1, plans: next })) {
              plans = next;
              render();
              toast("Plan deleted from this device.");
            }
          }
          break;
      }
    }
    if (el.dataset.tab) {
      savedTab = el.dataset.tab;
      render();
    }
    if (el.dataset.layer) {
      const key = el.dataset.layer;
      if (key === "all") {
        const on = !Object.values(settings.layers).every(Boolean);
        Object.keys(settings.layers).forEach(
          (key) => (settings.layers[key] = on),
        );
      } else settings.layers[key] = !settings.layers[key];
      saveSettings();
      render();
    }
    if (el.dataset.day) {
      selected = el.dataset.day;
      month = selected.slice(0, 7);
      render();
    }
    if (el.dataset.month) {
      const d = dateObj(month + "-01");
      d.setUTCMonth(d.getUTCMonth() + Number(el.dataset.month));
      if (d.getUTCFullYear() >= 1900 && d.getUTCFullYear() <= 2100) {
        month = iso(d).slice(0, 7);
        render();
      }
    }
    if (el.id === "calendar-today") {
      selected = today();
      month = selected.slice(0, 7);
      render();
    }
    if (el.id === "close-dialog") $("#calendar-dialog").close();
    if (el.id === "google-calendar")
      toast("Google Calendar opened. Review the event and tap Save there.");
    if (el.id === "download-ics") {
      calendarPlan.offsets = selectedOffsets("event-offset", "event-custom");
      if (plans.some((p) => p.id === calendarPlan.id)) savePlan(calendarPlan);
      download(icsFile(calendarPlan, calendarPlan.offsets));
    }
    if (el.id === "share-ics") await shareFile(calendarPlan);
    if (el.id === "save-offsets") {
      settings.offsets = selectedOffsets("default-offset", "default-custom");
      saveSettings();
      toast(
        "ICS defaults saved. Previously exported calendar events are unchanged.",
      );
    }
    if (el.id === "install-app") {
      if (installPrompt) {
        await installPrompt.prompt();
        const choice = await installPrompt.userChoice;
        toast(
          choice.outcome === "accepted"
            ? "Installation accepted."
            : "Installation dismissed.",
        );
        installPrompt = null;
      } else
        toast(
          "Use your browser menu to Install app / Add to Home Screen if supported.",
        );
    }
    if (el.id === "update-app" && registration?.waiting)
      registration.waiting.postMessage("activate-update");
  } catch (error) {
    toast(error.message || "Unable to complete this action.");
  }
});
document.addEventListener("change", (event) => {
  const el = event.target;
  if (el.id === "home-state" || el.id === "settings-state") {
    settings.state = el.value;
    saveSettings();
    render();
  }
  if (el.id === "district") {
    settings.district = el.value;
    saveSettings();
  }
  if (el.id === "rule-mode") updateRuleFields();
  if (el.dataset.setting) {
    const key = el.dataset.setting;
    if (key === "dark") settings.dark = el.checked;
    else settings.layers[key] = el.checked;
    saveSettings();
  }
  if (el.dataset.category) {
    settings.hidden = settings.hidden.filter(
      (id) => id !== el.dataset.category,
    );
    if (!el.checked) settings.hidden.push(el.dataset.category);
    saveSettings();
  }
  if (el.id === "overlay") {
    overlay = el.value;
    render();
  }
  if (el.id === "month-select" || el.id === "year-select") {
    month = `${$("#year-select").value}-${String($("#month-select").value).padStart(2, "0")}`;
    render();
  }
});
document.addEventListener("keydown", (event) => {
  const el = event.target;
  if (!el.dataset.day) return;
  const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
  if (event.key in offsets) {
    event.preventDefault();
    selected = shift(el.dataset.day, offsets[event.key]);
    month = selected.slice(0, 7);
    render();
    $(`[data-day="${selected}"]`)?.focus();
  }
});
window.addEventListener("hashchange", () => {
  render();
  window.scrollTo(0, 0);
  $("#main").focus({ preventScroll: true });
});
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
});
window.addEventListener("storage", (event) => {
  if (["bookday.settings.v1", "bookday.plans.v1"].includes(event.key))
    location.reload();
});
try {
  const responses = await Promise.all([
    fetch("/data/catalog.json"),
    fetch("/data/holidays.json"),
  ]);
  if (responses.some((r) => !r.ok)) throw Error("Data unavailable");
  [catalog, holidays] = await Promise.all(responses.map((r) => r.json()));
  if (!catalog.states.includes(settings.state)) settings.state = "Tamil Nadu";
  plans = plans.filter((p) => categoryFor(p.category));
  applySettings();
  render();
  setInterval(() => {
    for (const el of document.querySelectorAll("[data-countdown]")) {
      const p = findPlan(el.dataset.countdown);
      if (p) el.textContent = countdown(p);
    }
  }, 1000);
  if ("serviceWorker" in navigator) {
    registration = await navigator.serviceWorker.register("/sw.js");
    navigator.serviceWorker.addEventListener("controllerchange", () =>
      location.reload(),
    );
    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      worker?.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller)
          toast("An update is available. Apply it in Settings.");
      });
    });
  }
} catch (error) {
  $("#main").innerHTML = intro(
    "Unable to load BookDay",
    "Check your internet connection and reload. Offline use is available after a successful initial visit.",
  );
}
