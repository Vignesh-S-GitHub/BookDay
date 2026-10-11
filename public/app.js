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
const icon = (name) =>
  `<svg class="icon" aria-hidden="true"><use href="/art/icons.svg#${{ holidays: "calendar", long_weekend: "tourism" }[name] || name}"></use></svg>`;
const art = (name) => `/art/categories/${name}.webp`;
const displayLabel = (c) =>
  ({
    hotels: "Hotels",
    events: "Events",
    government: "Govt Services",
    appointments: "Appointments",
    custom: "Custom",
    healthcare: "Healthcare",
  })[c.id] || c.label;
const shortDate = (value) =>
  value
    ? new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(dateObj(value))
    : "Not announced";
const categoryIcon = (id) =>
  `<span class="category-symbol tone-${id}">${icon(id)}</span>`;
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
  return `<section class="bd-hero hero-${image}"><img src="/art/banners/${image}.webp" alt="${image === "kerala_backwaters" ? "Kerala houseboat on golden backwaters" : image === "train_journey" ? "Indian train on a tropical sunset journey" : "South Indian temple at sunset"}" fetchpriority="high"><div class="bd-hero-content"><h1>${title}</h1>${subtitle ? `<p>${subtitle}</p>` : ""}</div></section>`;
}
function intro(title, sub) {
  return `<div class="page-intro"><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ""}</div>`;
}
function categoryCards(categories, quick = false) {
  return `<div class="category-grid ${quick ? "quick" : ""}">${categories.map((c) => `<a class="category tone-${c.id}" href="#/book/${c.id}" aria-label="${esc(c.label)} booking planner"><img src="${art(quick ? "quick_" + c.id : c.id)}" alt="" width="320" height="320"><span class="category-caption">${quick ? "" : categoryIcon(c.id)}<span>${esc(displayLabel(c))}</span>${quick ? "" : icon("chevron")}</span></a>`).join("")}</div>`;
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
  return `${hero("home_india", "Plan Today,<br><span>Book Smarter</span>")}<div class="hero-pagination" aria-hidden="true"><i></i><i></i><i></i></div>${searchBox()}${categoryCards(["trains", "flights", "buses", "hotels", "movies", "temples", "events", "tourism"].map((id) => cats.find((c) => c.id === id)).filter(Boolean), true)}<div class="home-highlights"><a href="#/calendar" class="festival-card"><img src="/art/banners/india_festivals.webp" alt="Temple fireworks and glowing festive lamps"><div><small>${icon("calendar")}Next ${next?.festival ? "Festival" : "Verified Holiday"}</small><h2>${next ? esc(next.name) : "India Calendar"}</h2><p>${next ? shortDate(next.date) : "Explore known dates"}</p><span class="round-arrow">${icon("chevron")}</span></div></a><section class="next-card"><small>${icon("bell")}Next Booking Opens</small><img src="${art("upcoming_train")}" alt=""><h3>${nearest ? esc(nearest.title) : "Train Booking"}</h3><p>${nearest ? shortDate(nearest.result.opening_date) : "Find your opening date"}</p><a class="bd-primary full" href="${nearest ? "#/detail/" + nearest.id : "#/book/trains"}">${icon("clock")}${nearest ? "Set Reminder" : "Plan a Journey"}${icon("chevron")}</a></section></div><a class="travel-link" href="#/insights">${icon("tourism")}Travel insights${icon("chevron")}</a><details class="coverage-details"><summary>Calendar coverage</summary>${coverage()}</details>`;
}
function explore() {
  const cats = catalog.categories.filter((c) =>
    (c.label + " " + c.description).toLowerCase().includes(query.toLowerCase()),
  );
  const order = [
    "trains",
    "flights",
    "buses",
    "hotels",
    "movies",
    "temples",
    "events",
    "tourism",
    "appointments",
    "government",
    "education",
    "custom",
    "sports",
    "healthcare",
  ];
  cats.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
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
function miniCalendar(value) {
  const first = value.slice(0, 7) + "-01",
    d = dateObj(first),
    start = shift(first, -d.getUTCDay());
  const size =
    Math.ceil(
      (d.getUTCDay() +
        new Date(
          Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
        ).getUTCDate()) /
        7,
    ) * 7;
  return `<section class="mini-calendar card"><div class="mini-heading"><button type="button" class="icon-button" data-mini-month="-1" aria-label="Previous journey month">${icon("back")}</button><strong>${new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(d)}</strong><button type="button" class="icon-button" data-mini-month="1" aria-label="Next journey month">${icon("chevron")}</button></div><div class="mini-grid">${["S", "M", "T", "W", "T", "F", "S"].map((w) => `<small>${w}</small>`).join("")}${Array.from(
    { length: size },
    (_, i) => {
      const day = shift(start, i);
      return `<button type="button" class="${day === value ? "selected" : ""}" data-mini-day="${day}" ${day.slice(0, 7) !== value.slice(0, 7) ? 'tabindex="-1" disabled' : ""}>${day.slice(0, 7) === value.slice(0, 7) ? dateObj(day).getUTCDate() : ""}</button>`;
    },
  ).join("")}</div></section>`;
}
function plannerField(label, name, type, value, ico, extra = "") {
  const prettyDate =
    type === "date" && validDate(value)
      ? new Intl.DateTimeFormat("en-IN", {
          day: "2-digit",
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        }).format(dateObj(value))
      : "";
  const content = field(label, name, type, value, extra).replace(
    "</label>",
    `${type === "date" ? `<span class="pretty-date" aria-hidden="true">${prettyDate}</span>` : ""}</label>`,
  );
  return `<div class="planner-field ${type === "date" ? "date-field" : ""}"><span class="field-symbol field-${ico}">${icon(ico)}</span>${content}</div>`;
}
function updatePrettyDates() {
  for (const label of document.querySelectorAll(".date-field label")) {
    const input = label.querySelector("input"),
      output = label.querySelector(".pretty-date");
    output.textContent = validDate(input.value)
      ? new Intl.DateTimeFormat("en-IN", {
          day: "2-digit",
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        }).format(dateObj(input.value))
      : "";
  }
}
function calculator(id) {
  const c = categoryFor(id);
  if (!c)
    return intro("Category unavailable", "Choose a category from Explore.");
  const p = editPlan?.category === id ? editPlan : null;
  const date = p?.event_date || shift(today(), 60),
    mode = p?.mode || c.default_mode;
  return `${hero(id === "trains" ? "train_journey" : id === "temples" ? "temple_darshan" : "home_india", `${id === "trains" ? "Train" : esc(c.label)}<br><span>Booking</span>`, "Check booking dates<br>and plan your journey")}<form id="booking-form" hx-post="/fragments/calculate" hx-target="#server-result" hx-params="event_date,mode,amount,opening_time,fixed_date,origin_date,train_class,category" hx-request='{"timeout":15000}'><input type="hidden" name="category" value="${id}">${id === "trains" ? `<div class="booking-tabs"><button type="button" data-rule="days" class="${mode !== "tatkal" ? "active" : ""}">${icon("trains")}General</button><button type="button" data-rule="tatkal" class="${mode === "tatkal" ? "active" : ""}">${icon("bolt")}Tatkal</button></div>` : ""}<section class="card planner-fields">${plannerField("Journey Date", "event_date", "date", date, "calendar", 'required min="1900-01-01" max="2100-12-31"')}${plannerField("From", "origin", "text", p?.origin || "", "location", 'maxlength="100" placeholder="Chennai (MAS)"')}${plannerField("To", "destination", "text", p?.destination || "", "location", 'maxlength="100" placeholder="Bengaluru (SBC)"')}<div class="planner-field"><span class="field-symbol field-clock">${icon("calendar")}</span><div class="rule-display"><span>Advance Booking</span><strong id="rule-summary">${mode === "tatkal" ? "1 Day · Tatkal" : mode === "days" ? (p?.amount ?? catalog.rail.advance_days) + " Days" : "Your booking rule"}</strong><a href="#rule-options" id="show-rule-options" aria-label="Adjust booking rule">${icon("chevron")}</a></div></div><div data-field="origin_date">${plannerField("Departure at originating station", "origin_date", "date", p?.origin_date || "", "calendar", 'min="1900-01-01" max="2100-12-31"')}</div><div data-field="train_class"><label>Tatkal class<select class="bd-input" name="train_class"><option value="ac">AC · 10:00 IST</option><option value="non-ac" ${p?.train_class === "non-ac" ? "selected" : ""}>Non-AC · 11:00 IST</option></select></label></div></section><div class="planner-bottom"><div id="journey-calendar">${miniCalendar(date)}</div><aside class="rail-policy card"><img src="${art(id === "trains" ? "railway" : id)}" alt=""><h3>${id === "trains" ? "Indian Railways Standard Advance Booking" : "Your rule, your plan"}</h3><strong class="policy-days">${id === "trains" ? "60 Days" : "Plan Ahead"}</strong><p>${id === "trains" ? "You can book train tickets up to 60 days in advance from the journey date." : "Use a provider announcement or choose your own release rule."}</p></aside></div><button class="bd-primary full find-date" type="submit">Find Booking Date${icon("arrow")}</button><details id="rule-options" class="planner-options" ${mode !== "days" && mode !== "tatkal" ? "open" : ""}><summary>Booking rule &amp; plan details${icon("chevron")}</summary><div class="fields"><label>Booking rule<select class="bd-input" name="mode" id="rule-mode">${[["days", "N days before"], ["months", "N calendar months before"], ["fixed", "Fixed announced date"], ["weekly", "Recurring weekly"], ["monthly", "Recurring monthly"], ["unknown", "Not announced yet"], ...(id === "trains" ? [["tatkal", "Tatkal — origin departure date"]] : [])].map(([value, label]) => `<option value="${value}" ${value === mode ? "selected" : ""}>${label}</option>`).join("")}</select></label><div data-field="amount">${field("Days / months / recurring day", "amount", "number", p?.amount ?? (id === "trains" ? catalog.rail.advance_days : 30), 'min="0" max="3650" step="1"')}<p id="amount-help" class="hint"></p></div><div data-field="fixed_date">${field("Announced opening date", "fixed_date", "date", p?.fixed_date || "", 'min="1900-01-01" max="2100-12-31"')}</div><div data-field="opening_time">${field("Opening time (optional, IST)", "opening_time", "time", p?.opening_time || "")}<p class="hint">Leave blank if unknown. Exports use an all-day reminder.</p></div>${field("Plan title (optional)", "title", "text", p?.title || "", 'maxlength="120" placeholder="Chennai → Madurai"')}${field("Service / operator note (optional)", "service", "text", p?.service || "", 'maxlength="180"')}</div></details><div id="server-result" aria-live="polite"></div><details class="coverage-details"><summary>Booking policy &amp; privacy</summary><p class="hint">${id === "trains" ? esc(catalog.rail.warning) : "Confirm your rule with the provider; no standard release window is assumed."}</p>${id === "trains" ? `<a href="${catalog.rail.source}" target="_blank" rel="noopener">Advance policy source ↗</a><p><a href="${catalog.rail.tatkal_source}" target="_blank" rel="noopener">Tatkal policy source ↗</a></p>` : ""}<p class="hint">Titles and routes stay on this device. Only dates, rule and category are sent for calculation. Dates do not indicate ticket availability.</p></details></form>`;
}
function updateRuleFields() {
  const form = $("#booking-form");
  if (!form) return;
  const mode = form.elements.mode.value;
  for (const button of form.querySelectorAll("[data-rule]"))
    button.classList.toggle(
      "active",
      button.dataset.rule === "tatkal" ? mode === "tatkal" : mode !== "tatkal",
    );
  $("#rule-summary").textContent =
    mode === "tatkal"
      ? "1 Day · Tatkal"
      : mode === "days"
        ? form.elements.amount.value + " Days"
        : "Your booking rule";
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
  const r = p.result,
    known = !!r.opening_date;
  return `<section class="result-celebration"><img src="/art/celebration.webp" alt="Blue calendar and orange clock with celebratory confetti"><h1>${known ? "Great News!" : "Stay Tuned!"}</h1><p>Here’s your booking information</p></section><section class="card result"><h2 class="opening-heading">${icon("megaphone")}Booking Opens On</h2><div class="opening-date">${shortDate(r.opening_date)}</div><div class="result-facts"><div class="fact">${icon("calendar")}<small>Journey Date</small><strong>${shortDate(p.event_date)}</strong><small>${new Intl.DateTimeFormat("en-IN", { weekday: "short", timeZone: "UTC" }).format(dateObj(p.event_date))}</small></div><div class="fact">${icon("clock")}<small>Booking Time</small><strong>${r.opening_time ? esc(r.opening_time) : "Unknown"}</strong><small>${r.opening_time ? "(IST)" : "All-day reminder"}</small></div><div class="fact">${icon("events")}<small>Booking Rule</small><strong>${p.mode === "days" ? esc(p.amount) + " days" : p.mode === "tatkal" ? "Tatkal" : "Custom"}</strong><small>${p.mode === "days" ? "before journey" : p.mode === "tatkal" ? "before origin departure" : "See details below"}</small></div></div><div class="pro-tip">${icon("bulb")}<div><strong>Pro Tip</strong><p>${known ? "Set a reminder so you don’t miss the booking date. Tatkal and festival season tickets fill fast!" : "Save this plan and add the release date when your provider announces it."}</p></div></div><button class="bd-primary full reminder-action" data-action="calendar" data-id="${p.id}" ${known ? "" : "disabled"}>${icon("bell")}Set Reminder${icon("chevron")}</button><button class="bd-secondary full reminder-action" data-action="share" data-id="${p.id}">${icon("share")}Share Result${icon("chevron")}</button><div class="result-utilities"><button class="text-button" data-action="save" data-id="${p.id}">${icon("saved")}Save plan</button><button class="text-button" data-action="edit" data-id="${p.id}">Edit plan</button><button class="text-button" data-action="download" data-id="${p.id}" ${known ? "" : "disabled"}>Download .ics</button></div><details class="result-details"><summary>Plan details &amp; verified policy</summary><h3>${esc(p.title)}</h3><span class="badge">${status(p)}</span><span class="badge orange">${esc(r.verification_status || "Rule Unverified")}</span><p>${esc(r.rule)}</p><p class="countdown" data-countdown="${p.id}">${countdown(p)}</p>${p.source ? `<p><a href="${esc(p.source)}" target="_blank" rel="noopener">Verified policy source ↗</a></p>` : ""}${categoryFor(p.category).provider_url ? `<a target="_blank" rel="noopener" href="${categoryFor(p.category).provider_url}">Official booking site ↗</a>` : ""}<p class="hint">An opening date does not guarantee availability. Exported calendars deliver their own reminders after import. BookDay does not send background notifications.</p></details></section>`;
}
function saved() {
  const upcoming = plans.filter((p) => !p.completed && p.event_date >= today());
  const completed = plans.filter((p) => p.completed || p.event_date < today());
  const list = (savedTab === "completed" ? completed : upcoming).toSorted(
    (a, b) =>
      (a.result.opening_date || "9999").localeCompare(
        b.result.opening_date || "9999",
      ),
  );
  return (
    intro("Saved", "Your saved bookings and plans") +
    `<div class="tabs"><button data-tab="upcoming" class="${savedTab === "upcoming" ? "active" : ""}">Upcoming (${upcoming.length})</button><button data-tab="completed" class="${savedTab === "completed" ? "active" : ""}">Completed (${completed.length})</button></div><div class="saved-grid">${list
      .map((p) => {
        const days = p.result.opening_date
          ? Math.max(
              0,
              Math.round(
                (dateObj(p.result.opening_date) - dateObj(today())) / 86400000,
              ),
            )
          : null;
        return `<article class="saved-card tone-${p.category}"><a href="#/detail/${p.id}" class="saved-thumbnail" aria-label="View ${esc(p.title)}"><img src="${art(["trains", "temples", "movies", "hotels", "government"].includes(p.category) ? "saved_" + p.category : p.category)}" alt=""></a><div class="saved-info"><div class="saved-title">${categoryIcon(p.category)}<div><a href="#/detail/${p.id}"><h3>${esc(p.title)}</h3></a><small>${esc(p.categoryLabel)} Booking</small></div></div><p class="saved-opening">${icon("calendar")}<span>Opens on ${shortDate(p.result.opening_date)}</span></p></div><div class="saved-side"><details class="plan-menu"><summary aria-label="Actions for ${esc(p.title)}">${icon("more")}</summary><div>${planActions(p, false)}<button class="text-button" data-action="edit" data-id="${p.id}">Edit</button><button class="text-button" data-action="complete" data-id="${p.id}">${p.completed ? "Reopen" : "Complete"}</button><button class="text-button" data-action="delete" data-id="${p.id}">Delete</button></div></details><span class="days-left"><strong>${days === null ? "—" : days}</strong><small>${days === null ? "Unannounced" : status(p) === "Already Opened" ? "opened" : days === 0 ? "opens today" : "days left"}</small></span></div></article>`;
      })
      .join(
        "",
      )}</div>${list.length ? "" : `<div class="card empty"><img src="${art("appointments")}" alt=""><h2>No plans here yet</h2><p>Find an opening date, then save it to keep it here.</p><a class="bd-primary" href="#/explore">Create a booking plan</a></div>`}<a class="floating-add" href="#/explore" aria-label="Create a booking plan">${icon("plus")}</a><details class="coverage-details"><summary>About saved plans</summary><p class="hint">Plans move to Completed after the event date or when marked complete. Device data is not synced and can be cleared by your browser; calendar exports keep a separate reminder.</p></details>`
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
  const visibleDays =
    Math.ceil(
      (d.getUTCDay() + new Date(Date.UTC(year, m + 1, 0)).getUTCDate()) / 7,
    ) * 7;
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
    const markedHoliday = h.find(
      (h) =>
        (layers.holidays &&
          ["national_public", "state_public"].includes(h.type)) ||
        (layers.festivals && h.festival),
    );
    const marker = markedHoliday
      ? icon(
          markedHoliday.type === "national_public"
            ? "flag"
            : markedHoliday.festival
              ? "festivals"
              : "calendar",
        )
      : layers.bookings && opening.length
        ? icon(opening[0].category)
        : marks;
    cells += `<button class="day ${day === selected ? "selected" : ""} ${day === today() ? "today" : ""} ${day.slice(0, 7) !== month ? "off" : ""} ${long ? "weekend" : ""} ${markedHoliday ? "has-holiday" : ""} ${layers.bookings && opening.length ? "has-booking" : ""}" ${i >= visibleDays ? "hidden" : ""} data-day="${day}" aria-label="${formatDate(day)}${marks ? ", calendar signals" : ""}" aria-pressed="${day === selected}" ${day === today() ? 'aria-current="date"' : ""}>${dateObj(day).getUTCDate()}<span class="dots">${marker}</span></button>`;
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
  return `${hero("temple_darshan", "India Calendar", "Holidays · Festivals · Long Weekends")}<div class="chips"><button class="chip" data-layer="all" aria-pressed="${Object.values(layers).every(Boolean)}">All</button>${Object.entries(
    layerLabels,
  )
    .filter(([key]) => key !== "bookings")
    .map(
      ([key, label]) =>
        `<button class="chip" data-layer="${key}" aria-pressed="${layers[key]}">${{ holidays: "Holidays", festivals: "Festivals", weekends: "Long Weekend", demand: "High Demand" }[key]}</button>`,
    )
    .join(
      "",
    )}</div><div class="calendar-layout"><section class="card calendar-card"><div class="month-controls"><button class="icon-button" data-month="-1" aria-label="Previous month">‹</button><select id="month-select" aria-label="Month">${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}" ${i === m ? "selected" : ""}>${new Intl.DateTimeFormat("en-IN", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(year, i, 1)))}</option>`).join("")}</select><select id="year-select" aria-label="Year">${Array.from({ length: 201 }, (_, i) => `<option ${1900 + i === year ? "selected" : ""}>${1900 + i}</option>`).join("")}</select><button class="icon-button" data-month="1" aria-label="Next month">›</button></div><div class="date-grid">${["S", "M", "T", "W", "T", "F", "S"].map((w) => `<span class="weekday">${w}</span>`).join("")}${cells}</div></section><section class="card detail-list"><div><small>${formatDate(selected)} · ${esc(state)}</small></div>${selectedRows.map((h) => `<article><img class="holiday-thumbnail" src="/art/banners/temple_darshan.webp" alt=""><div><h3>${esc(h.name)}</h3><span class="badge">${esc(h.type.replaceAll("_", " "))}</span><span class="badge green">${esc(h.status)}</span><p>${esc(h.note)}</p><details class="coverage-details"><summary>Official source &amp; review</summary><small>Reviewed ${h.reviewed} · ${esc(h.jurisdictions.join(", "))}</small><p><a href="${esc(h.source)}" target="_blank" rel="noopener">Official source ↗</a></p></details></div></article>`).join("")}${bookings.map((p) => `<a href="#/detail/${p.id}"><h3>${esc(p.title)}</h3><p>Booking opens ${p.result.opening_time || "time unknown"} →</p></a>`).join("")}${block ? `<div><span class="badge orange">${block.length} day long weekend</span><p>${formatDate(block[0])} – ${formatDate(block.at(-1))}. Assumes Saturday and Sunday off; check your employer schedule.</p></div>` : ""}${layers.demand ? `<div class="demand-summary">${icon("demand")}<div><h3>${demand.label} expected demand</h3><p>${esc(demand.reasons.join(", ") || "No verified local data for this date.")}.</p><small>Calendar heuristic; no price prediction.</small></div></div>` : ""}${selectedRows.length || bookings.length ? "" : "<p>No matching verified records or saved openings for this date. This does not mean the date is a working day.</p>"}</section></div><details class="coverage-details"><summary>Calendar options &amp; coverage</summary><button class="bd-secondary full" id="calendar-today">Today</button><p class="hint">● Public holiday / saved opening · ◆ Festival · pale amber: derived long weekend.</p><details class="coverage-details calendar-overlay"><summary>Destination overlay</summary><label>Destination overlay (optional)<select id="overlay" class="bd-input"><option value="">Home: ${esc(settings.state)}</option>${stateOptions(overlay)}</select></label></details>${coverage()}</details>`;
}
function insights() {
  const state = overlay || "Kerala";
  return (
    hero(
      "kerala_backwaters",
      `<small>TRAVEL INSIGHTS</small><br>${esc(state)}`,
      "Backwaters · Beaches · Hill Stations",
    ) +
    `<form id="insights-form" class="insights-filters"><label>${categoryIcon("location")}<span>Destination<select class="bd-input" name="state">${stateOptions(state)}</select></span></label><label>${categoryIcon("calendar")}<span>Travel Date<input class="bd-input" name="date" type="date" value="${selected}" min="1900-01-01" max="2100-12-31" required></span></label><label>${categoryIcon("hotels")}<span>Stay<input class="bd-input" name="duration" type="number" value="3" min="1" max="30" required aria-label="Stay duration in days"></span></label><button class="text-button" type="submit">Update insights</button></form><div class="insights-title">${icon("bulb")}<div><h2>Travel Insights</h2><p>Plan smarter with calendar travel insights</p></div></div><div id="insights-result" aria-live="polite"></div><details class="coverage-details"><summary>Sources &amp; coverage</summary>${coverage()}</details>`
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
    `<div class="insight-grid"><article class="insight-card demand-card"><div>${icon("demand")}<span><h3>${score === 2 ? "High Demand" : score === 1 ? "Moderate Demand" : "Limited Data"}</h3><span class="badge">${score ? "Calendar signal" : "Coverage incomplete"}</span></span></div><p>${esc(reasons.join(", ") || "No verified destination events in this curated dataset.")}.</p></article><article class="insight-card holiday-card"><div>${icon("calendar")}<span><h3>Nearby Holiday</h3><span class="badge">${nearby.length ? esc(nearby[0].name) : "No known records"}</span></span></div><p>${nearby.map((h) => `${esc(h.name)} (${shortDate(h.date)})`).join(" · ") || "No verified nearby dates in the available records."}</p></article><article class="insight-card weekend-card"><div>${icon("calendar")}<span><h3>Long Weekend</h3><span class="badge">${blocks.length ? "Great for Travel" : "Check your dates"}</span></span></div><p>${blocks.map((b) => `${b.length}-day weekend: ${shortDate(b[0])} – ${shortDate(b.at(-1))}`).join(" · ") || "No derived long weekend during this stay."}</p></article><article class="insight-card alternate-card"><div>${icon("check")}<span><h3>Alternate Dates</h3><span class="badge">Fewer known signals</span></span></div><p>${
      alternatives
        .slice(0, 3)
        .map((d) => shortDate(d))
        .join(" · ") || "No lower-signal dates found in the adjacent week."
    }</p></article></div><a class="bd-primary full reminder-action" href="#/book/hotels">${icon("bell")}Track This Trip${icon("chevron")}</a><p class="insight-caption">Save a stay plan and export a calendar reminder.</p><details class="coverage-details"><summary>How these insights work</summary><p class="hint">These estimates use weekends and verified calendar records. Missing coverage prevents a reliable Low label. Alternative dates have fewer known signals; prices and availability are not predicted. Long weekends assume Saturday and Sunday off.</p></details>`;
}

function more() {
  const toggle = (key, label, sub, ico) =>
    `<label class="settings-row setting-${key}"><div>${icon(ico)}<span><strong>${label}</strong><small>${sub}</small></span></div><input type="checkbox" data-setting="${key}" ${key === "dark" ? (settings.dark ? "checked" : "") : settings.layers[key] ? "checked" : ""}></label>`;
  return (
    intro("Settings", "") +
    `<div class="settings-list"><label class="settings-row"><div>${categoryIcon("location")}<span><strong>State</strong><small>Select your state for accurate holidays</small></span></div><select id="settings-state" class="bd-input">${stateOptions(settings.state)}</select></label><div class="settings-row"><div>${categoryIcon("language")}<span><strong>Language</strong><small>Interface language</small></span></div><strong class="setting-value">English</strong></div>${toggle("holidays", "Show Holidays", "Display public holidays in calendar", "calendar")}${toggle("festivals", "Show Festivals", "Display festivals in your calendar", "festivals")}${toggle("weekends", "Show Long Weekends", "Highlight long weekend opportunities", "tourism")}<a class="settings-row" href="#/reminders"><div>${icon("bell")}<span><strong>Calendar Reminders</strong><small>Get reminders from your calendar app</small></span></div>${icon("chevron")}</a>${toggle("dark", "Dark Mode", "Switch to a dark theme", "moon")}<details><summary>${categoryIcon("clock")}Reminder Time</summary><p class="hint">ICS reminders before the booking opening. Google Calendar uses its own notification settings.</p>${offsetChecks(settings.offsets, "default-offset")}<label>Custom offset (minutes before)<input class="bd-input" id="default-custom" type="number" min="0" max="525600" value="${settings.offsets.find((n) => ![0, 60, 1440, 10080].includes(n)) ?? ""}"></label><button class="bd-primary full" id="save-offsets">Save reminder defaults</button></details><details><summary>${categoryIcon("custom")}Manage Categories</summary>${catalog.categories.map((c) => `<label class="check-row"><input type="checkbox" data-category="${c.id}" ${settings.hidden.includes(c.id) ? "" : "checked"}>${esc(c.label)}</label>`).join("")}<p class="hint">All 14 categories remain available in Explore.</p></details><details class="about-card"><summary><img class="logo" src="/art/logo.webp" alt="BookDay"><small>Version 1.1.0<br>Plan Today, Book Smarter</small></summary><p>Know When to Book. Plan booking openings and export calendar reminders.</p>${coverage()}</details><details><summary>Additional preferences</summary><label class="settings-row"><span><strong>District (optional)</strong><small>Stored locally; district records not available yet</small></span><input id="district" class="bd-input" maxlength="80" value="${esc(settings.district)}"></label>${toggle("bookings", "Show Booking Openings", "Saved openings in your calendar", "clock")}${toggle("demand", "Show Demand Signals", "Calendar estimates", "demand")}<button class="bd-secondary full" id="install-app">Install BookDay</button><button class="bd-secondary full" id="update-app" ${registration?.waiting ? "" : "hidden"}>Apply available update</button></details><details><summary>Privacy and device storage</summary><p>No account is required. Titles, routes, saved plans and settings stay in your browser. Calculation dates, rule parameters and category are sent to the BookDay API. Saving a plan does not send it to a server. Calendar and share actions send the selected plan to the destination you choose.</p><p>BookDay does not operate push, email or Telegram reminders. The interface font is bundled for online and offline use. Cloudflare processes web requests and operational logs, including request metadata. Form bodies are not logged by the app.</p><p>Use ICS or your calendar to retain reminders before clearing browser storage. Device data is not synced.</p></details><details><summary>Data and booking information</summary><p>Holiday coverage is incomplete. Festival, public holiday, bank, school and local-event records have different meanings. The app has no live availability or pricing integrations. Verify provider exceptions and your employer's holiday schedule.</p></details></div>`
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
  document.body.dataset.route = route;
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
  if (route === "insights") renderInsights($("#insights-form"));
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
    if (el.dataset.rule) {
      $("#rule-mode").value = el.dataset.rule;
      updateRuleFields();
    }
    if (el.id === "show-rule-options") {
      event.preventDefault();
      $("#rule-options").open = true;
      $("#rule-options").scrollIntoView({ block: "center" });
    }
    if (el.dataset.miniDay || el.dataset.miniMonth) {
      const field = $("#booking-form").elements.event_date;
      if (el.dataset.miniDay) field.value = el.dataset.miniDay;
      else {
        const d = dateObj(field.value);
        d.setUTCDate(1);
        d.setUTCMonth(d.getUTCMonth() + Number(el.dataset.miniMonth));
        if (d.getUTCFullYear() < 1900 || d.getUTCFullYear() > 2100) return;
        field.value = iso(d);
      }
      $("#journey-calendar").innerHTML = miniCalendar(field.value);
      updatePrettyDates();
    }
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
  if (el.id === "rule-mode" || el.name === "amount") updateRuleFields();
  if (el.name === "event_date" && validDate(el.value))
    $("#journey-calendar").innerHTML = miniCalendar(el.value);
  if (el.closest(".date-field")) updatePrettyDates();
  if (el.closest("#insights-form") && $("#insights-form").checkValidity())
    renderInsights($("#insights-form"));
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
    const alreadyControlled = Boolean(navigator.serviceWorker.controller);
    registration = await navigator.serviceWorker.register("/sw.js");
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (alreadyControlled) location.reload();
    });
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
