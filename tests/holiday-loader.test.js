import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { HolidayLoader } from "../public/holiday-loader.js";
const manifest = {
  version: "v1",
  coverage: [],
  festival_art: {},
  changes: [],
  datasets: {
    "2026:IN": { url: "/data/holidays/2026/national-hash.json", version: "v1" },
    "2026:Tamil Nadu": {
      url: "/data/holidays/2026/tamil-nadu-hash.json",
      version: "v1",
    },
    "2025:Tamil Nadu": {
      url: "/data/holidays/2025/tamil-nadu-hash.json",
      version: "v1",
    },
    "2026:Kerala": {
      url: "/data/holidays/2026/kerala-hash.json",
      version: "v1",
    },
  },
};
test("default browser fetch is called without a class receiver", async (t) => {
  t.mock.method(globalThis, "fetch", async function (url) {
    assert.equal(this, undefined);
    return {
      ok: true,
      json: async () =>
        url.includes("manifest")
          ? manifest
          : { version: "v1", records: [{ id: url }], festival_calendar: [] },
    };
  });
  const loader = new HolidayLoader();
  await loader.init();
  assert.equal((await loader.load([2026], ["Tamil Nadu"])).records.length, 2);
});
test("selected year and overlay are loaded without downloading every state/year", async () => {
  const calls = [];
  const loader = new HolidayLoader(async (url) => {
    calls.push(url);
    return {
      ok: true,
      json: async () =>
        url.includes("manifest")
          ? manifest
          : { version: "v1", records: [{ id: url }], festival_calendar: [] },
    };
  });
  await loader.init();
  const data = await loader.load([2026], ["Tamil Nadu", "Kerala"]);
  assert.equal(data.records.length, 3);
  assert.equal(
    calls.some((url) => url.includes("/2025/")),
    false,
  );
  await loader.load([2026], ["Tamil Nadu", "Kerala"]);
  assert.equal(calls.length, 4);
});
test("missing regions and failed datasets are explicit, other data stays available", async () => {
  const loader = new HolidayLoader(async (url) => ({
    ok: !url.includes("kerala"),
    json: async () => ({
      version: "v1",
      records: [{ id: "same" }],
      festival_calendar: [],
    }),
  }));
  loader.manifest = manifest;
  const data = await loader.load([2026], ["Kerala", "Goa"]);
  assert.equal(data.records.length, 1);
  assert.deepEqual(data.unavailable, ["2026:Kerala"]);
  assert.deepEqual(data.missing, ["2026:Goa"]);
});
test("wrong-version files cannot overwrite reviewed data and can be retried", async () => {
  let version = "stale";
  const loader = new HolidayLoader(async () => ({
    ok: true,
    json: async () => ({ version, records: [], festival_calendar: [] }),
  }));
  loader.manifest = manifest;
  assert.deepEqual((await loader.load([2026], [])).unavailable, ["2026:IN"]);
  version = "v1";
  assert.deepEqual((await loader.load([2026], [])).unavailable, []);
});
test("multi-jurisdiction records are deduplicated by stable ID", async () => {
  const loader = new HolidayLoader(async () => ({
    ok: true,
    json: async () => ({
      version: "v1",
      records: [{ id: "mixed", jurisdictions: ["Tamil Nadu", "Kerala"] }],
      festival_calendar: [],
    }),
  }));
  loader.manifest = manifest;
  assert.equal(
    (await loader.load([2026], ["Tamil Nadu", "Kerala"])).records.length,
    1,
  );
});

function liveFixture(version = "live-v1") {
  const payload = {
    festival_calendar: [],
    records: [{ date: "2026-01-01", id: "live" }],
    version,
  };
  const serialized = `{"festival_calendar": [], "records": [{"date": "2026-01-01", "id": "live"}], "version": "${version}"}`;
  return {
    payload,
    manifest: {
      ...manifest,
      schema: 2,
      version,
      datasets: {
        "2026:IN": {
          url: `/data/holidays/2026/national-${version}.json`,
          version,
          checksum: createHash("sha256").update(serialized).digest("hex"),
        },
      },
    },
  };
}
function memoryCache(t) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "caches");
  const responses = new Map();
  const cache = {
    put: async (url, response) => responses.set(url, response.clone()),
    match: async (url) => responses.get(url)?.clone(),
  };
  Object.defineProperty(globalThis, "caches", {
    configurable: true,
    value: { open: async () => cache, match: cache.match },
  });
  t.after(() =>
    previous
      ? Object.defineProperty(globalThis, "caches", previous)
      : delete globalThis.caches,
  );
  return responses;
}

test("live release loads checksum-verified data and refreshes without app deployment", async (t) => {
  memoryCache(t);
  let fixture = liveFixture();
  let now = 1000000;
  t.mock.method(Date, "now", () => now);
  const calls = [];
  const loader = new HolidayLoader(
    async (url) => {
      calls.push(url);
      return Response.json(
        url.includes("manifest") ? fixture.manifest : fixture.payload,
      );
    },
    { liveBase: "https://feed.example/public" },
  );
  await loader.init();
  assert.equal((await loader.load([2026], [])).records[0].id, "live");
  assert.equal(calls.length, 2);
  await loader.load([2026], []);
  assert.equal(calls.length, 2);
  fixture = liveFixture("live-v2");
  now += 16 * 60 * 1000;
  assert.equal((await loader.load([2026], [])).publication_version, "live-v2");
  assert.equal(calls.length, 4);
});

test("source outage uses last successful live manifest and annual data offline", async (t) => {
  memoryCache(t);
  const fixture = liveFixture();
  const online = new HolidayLoader(
    async (url) =>
      Response.json(
        url.includes("manifest") ? fixture.manifest : fixture.payload,
      ),
    { liveBase: "https://feed.example/public" },
  );
  await online.init();
  await online.load([2026], []);
  const offline = new HolidayLoader(
    async () => {
      throw Error("offline");
    },
    { liveBase: "https://feed.example/public" },
  );
  await offline.init();
  assert.deepEqual((await offline.load([2026], [])).unavailable, []);
  assert.equal(offline.manifest.version, fixture.manifest.version);
});

test("malformed live manifest falls back to bundled data and cannot poison cache", async (t) => {
  const cache = memoryCache(t);
  const loader = new HolidayLoader(
    async (url) =>
      url.startsWith("https:")
        ? new Response("not JSON")
        : Response.json(manifest),
    { liveBase: "https://feed.example/public" },
  );
  await loader.init();
  assert.equal(loader.base, "");
  assert.equal(loader.manifest.version, "v1");
  assert.equal(
    cache.has("https://feed.example/public/data/holidays/manifest.json"),
    false,
  );
});

test("tampered annual data is rejected, not cached, and can be retried", async (t) => {
  const cache = memoryCache(t);
  const fixture = liveFixture();
  let tampered = true;
  const loader = new HolidayLoader(
    async (url) =>
      Response.json(
        url.includes("manifest")
          ? fixture.manifest
          : tampered
            ? { ...fixture.payload, records: [{ id: "tampered" }] }
            : fixture.payload,
      ),
    { liveBase: "https://feed.example/public" },
  );
  await loader.init();
  assert.deepEqual((await loader.load([2026], [])).unavailable, ["2026:IN"]);
  assert.equal(
    [...cache.keys()].some((url) => url.includes("national-")),
    false,
  );
  tampered = false;
  assert.deepEqual((await loader.load([2026], [])).unavailable, []);
});
