import test from "node:test";
import assert from "node:assert/strict";
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
