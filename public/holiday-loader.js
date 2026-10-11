// Only selected years/jurisdictions are fetched. Race winners are chosen by caller.
export const LIVE_HOLIDAY_BASE =
  "https://raw.githubusercontent.com/Vignesh-S-GitHub/BookDay/holiday-data/public";

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(", ")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}: ${canonical(value[key])}`)
      .join(", ")}}`;
  return JSON.stringify(value);
}

async function verifyChecksum(data, expected) {
  if (!expected) return; // Compatibility with legacy/local test manifests.
  const bytes = new TextEncoder().encode(canonical(data));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  const actual = [...new Uint8Array(hash)]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
  if (actual !== expected) throw Error("Annual dataset checksum mismatch");
}

async function cachedResponse(url) {
  if (!globalThis.caches) return null;
  try {
    return await caches.match(url);
  } catch {
    return null;
  }
}
async function retainResponse(url, response) {
  if (!globalThis.caches) return;
  try {
    const cache = await caches.open("bookday-holiday-data");
    await cache.put(url, response);
  } catch {
    // Storage may be disabled/full. A successful online read remains usable.
  }
}
async function validManifest(response) {
  if (!response?.ok) return false;
  try {
    const data = await response.clone().json();
    return (
      data.schema === 2 &&
      data.datasets &&
      data.version &&
      Array.isArray(data.coverage) &&
      Object.values(data.datasets).every(
        (entry) =>
          /^\/data\/holidays\/\d{4}\/[a-z0-9-]+\.json$/.test(entry.url) &&
          entry.version === data.version &&
          /^[a-f0-9]{64}$/.test(entry.checksum),
      )
    );
  } catch {
    // An invalid upstream response cannot replace a previously valid manifest.
    return false;
  }
}
export class HolidayLoader {
  constructor(fetcher = (...args) => fetch(...args), { liveBase = "" } = {}) {
    this.fetcher = fetcher;
    this.cache = new Map();
    this.manifest = null;
    this.liveBase = liveBase;
    this.base = "";
    this.checkedAt = 0;
  }
  async liveResponse(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    try {
      const response = await this.fetcher(url, {
        signal: controller.signal,
        cache: "no-cache",
      });
      if (response.ok) return response;
    } catch {
      // Source or network outage: retain the last successfully cached data.
    } finally {
      clearTimeout(timer);
    }
    return await cachedResponse(url);
  }
  async init() {
    let response;
    let base = "";
    if (this.liveBase) {
      const url = this.liveBase + "/data/holidays/manifest.json";
      let candidate = await this.liveResponse(url);
      if (!(await validManifest(candidate)))
        candidate = await cachedResponse(url);
      if (await validManifest(candidate)) {
        response = candidate;
        base = this.liveBase;
      }
    }
    response ??= await this.fetcher("/data/holidays/manifest.json");
    if (!response.ok) throw Error("Holiday manifest unavailable");
    const copy = globalThis.caches ? response.clone() : null;
    this.manifest = await response.json();
    this.base = base;
    this.checkedAt = Date.now();
    if (copy) await retainResponse(base + "/data/holidays/manifest.json", copy);
    return this.manifest;
  }
  async dataset(entry) {
    const url = this.base + entry.url;
    if (this.cache.has(url)) return this.cache.get(url);
    const request = this.base ? this.liveResponse(url) : this.fetcher(url);
    const promise = request.then(async (response) => {
      if (!response) throw Error("Annual dataset unavailable");
      if (!response.ok) throw Error("Annual dataset unavailable");
      const copy = globalThis.caches ? response.clone() : null;
      const data = await response.json();
      if (data.version !== entry.version)
        throw Error("Dataset version mismatch");
      await verifyChecksum(data, entry.checksum);
      if (copy) await retainResponse(url, copy);
      return data;
    });
    this.cache.set(url, promise);
    try {
      return await promise;
    } catch (error) {
      this.cache.delete(url);
      throw error;
    }
  }
  async load(years, states) {
    if (this.liveBase && Date.now() - this.checkedAt > 15 * 60 * 1000)
      await this.init();
    const keys = [...new Set(years)].flatMap((year) =>
      [...new Set(["IN", ...states])].map((state) => `${year}:${state}`),
    );
    const present = keys.filter((key) => this.manifest.datasets[key]);
    const results = await Promise.allSettled(
      present.map((key) => this.dataset(this.manifest.datasets[key])),
    );
    const data = {
      records: [],
      festival_calendar: [],
      festival_art: this.manifest.festival_art,
      festival_regions: this.manifest.festival_regions,
      coverage: this.manifest.scope,
      festival_coverage:
        "Only validated, published year-specific dates are shown. Official calendars are checked automatically; unavailable years and regions retain their existing data.",
      coverage_rows: this.manifest.coverage.filter(
        (row) =>
          years.includes(row.year) &&
          ["IN", ...states].includes(row.jurisdiction),
      ),
      changes: this.manifest.changes,
      publication_version: this.manifest.version,
      unavailable: [],
    };
    for (const [i, result] of results.entries()) {
      if (result.status === "fulfilled") {
        data.records.push(...result.value.records);
        data.festival_calendar.push(...result.value.festival_calendar);
      } else data.unavailable.push(present[i]);
    }
    data.missing = keys.filter((key) => !this.manifest.datasets[key]);
    for (const field of ["records", "festival_calendar"])
      data[field] = [
        ...new Map(data[field].map((row) => [row.id, row])).values(),
      ];
    return data;
  }
}
