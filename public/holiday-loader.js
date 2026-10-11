// Only selected years/jurisdictions are fetched. Race winners are chosen by caller.
async function retainResponse(url, response) {
  if (!globalThis.caches) return;
  try {
    const cache = await caches.open("bookday-holiday-data");
    await cache.put(url, response);
  } catch {
    // Storage may be disabled/full. A successful online read remains usable.
  }
}
export class HolidayLoader {
  constructor(fetcher = (...args) => fetch(...args)) {
    this.fetcher = fetcher;
    this.cache = new Map();
    this.manifest = null;
  }
  async init() {
    const response = await this.fetcher("/data/holidays/manifest.json");
    if (!response.ok) throw Error("Holiday manifest unavailable");
    const copy = globalThis.caches ? response.clone() : null;
    this.manifest = await response.json();
    if (copy) await retainResponse("/data/holidays/manifest.json", copy);
    return this.manifest;
  }
  async dataset(entry) {
    if (this.cache.has(entry.url)) return this.cache.get(entry.url);
    const promise = this.fetcher(entry.url).then(async (response) => {
      if (!response.ok) throw Error("Annual dataset unavailable");
      const copy = globalThis.caches ? response.clone() : null;
      const data = await response.json();
      if (data.version !== entry.version)
        throw Error("Dataset version mismatch");
      if (copy) await retainResponse(entry.url, copy);
      return data;
    });
    this.cache.set(entry.url, promise);
    try {
      return await promise;
    } catch (error) {
      this.cache.delete(entry.url);
      throw error;
    }
  }
  async load(years, states) {
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
        "Only reviewed year-specific festival dates are shown. Unpublished years and regions remain incomplete.",
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
