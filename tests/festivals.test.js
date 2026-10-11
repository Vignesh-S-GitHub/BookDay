import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  calendarRecords,
  festivalImage,
  festivalSymbol,
  yearFestivals,
} from "../public/festivals.js";

const data = JSON.parse(
  readFileSync(
    new URL("../data/holidays/approved.json", import.meta.url),
    "utf8",
  ),
);
// Stable fixtures exercise date-selection rules independently of daily live imports.
data.festival_regions = Object.fromEntries(
  [...new Set(data.records.flatMap((row) => row.jurisdictions))].map(
    (state) => [
      state,
      [
        ...new Set(
          data.records
            .filter(
              (row) => row.jurisdictions.includes(state) && row.festival_id,
            )
            .map((row) => row.festival_id),
        ),
      ],
    ],
  ),
);
const rows = (state, year, id) =>
  calendarRecords(data, state).filter(
    (r) => r.date.startsWith(`${year}-`) && r.festival_id === id,
  );

test("festival dates change by year while artwork identity stays stable", () => {
  const diwali2026 = rows("Tamil Nadu", 2026, "diwali")[0];
  const diwali2027 = rows("Tamil Nadu", 2027, "diwali")[0];
  assert.equal(diwali2026.date, "2026-11-08");
  assert.equal(diwali2027.date, "2027-10-29");
  assert.equal(
    festivalImage(data, diwali2026),
    festivalImage(data, diwali2027),
  );
  assert.equal(rows("Tamil Nadu", 2026, "holi").length, 0);
  assert.equal(rows("Tamil Nadu", 2027, "holi").length, 0);
  assert.equal(rows("Tamil Nadu", 2027, "onam").length, 0);
  assert.equal(rows("Tamil Nadu", 2026, "durga_puja").length, 0);
  assert.equal(rows("Kerala", 2027, "onam")[0].date, "2027-09-12");
});

test("local dates override conflicting central observance dates without duplicates", () => {
  assert.equal(rows("Tamil Nadu", 2026, "pongal")[0].date, "2026-01-15");
  const bakrid = rows("Tamil Nadu", 2026, "eid_adha");
  assert.equal(bakrid.length, 1);
  assert.equal(bakrid[0].date, "2026-05-28");
  assert.equal(rows("Delhi", 2026, "eid_adha").length, 0);
  assert.equal(rows("Kerala", 2026, "vishu")[0].date, "2026-04-15");
  assert.equal(rows("Kerala", 2026, "dussehra")[0].date, "2026-10-21");
  assert.equal(rows("Tamil Nadu", 2026, "dussehra")[0].date, "2026-10-20");
  assert.equal(rows("Kerala", 2026, "onam").length, 3);
  assert.equal(
    yearFestivals(data, "Kerala", 2026).find(
      (r) => r.festival_id === "good_friday",
    ).date,
    "2026-04-03",
  );
  assert.equal(rows("Kerala", 2026, "good_friday").length, 2);
  assert.equal(
    yearFestivals(data, "Kerala", 2026).filter((r) => r.festival_id === "onam")
      .length,
    1,
  );
});

test("observance dates never invent statewide leave or unreviewed years", () => {
  assert.equal(Object.keys(data.festival_art).length, 34);
  assert.equal(data.festival_calendar.length, 65);
  assert.ok(
    data.festival_calendar.every(
      (r) => r.type === "religious_festival" && r.source.startsWith("https://"),
    ),
  );
  assert.equal(yearFestivals(data, "Tamil Nadu", 2026).length, 17);
  assert.equal(yearFestivals(data, "Tamil Nadu", 2027).length, 16);
  assert.equal(yearFestivals(data, "Tamil Nadu", 2028).length, 0);
  assert.equal(rows("Tamil Nadu", 2027, "vishu").length, 0);
  assert.equal(rows("Tamil Nadu", 2027, "thai_poosam").length, 0);
  const localGuide = {
    ...data,
    records: [],
    festival_calendar: [
      { ...data.festival_calendar[0], jurisdictions: ["Kerala"] },
    ],
  };
  assert.equal(calendarRecords(localGuide, "Tamil Nadu").length, 0);
  assert.equal(calendarRecords(localGuide, "Kerala").length, 1);
  assert.equal(
    festivalImage(data, { festival_id: "unmapped" }, "/fallback.webp"),
    "/fallback.webp",
  );
});

test("festival identities choose faith symbols and neutral civil/unknown symbols", () => {
  for (const [festival_id, symbol] of Object.entries({
    diwali: "festival-lamp",
    eid_fitr: "festival-crescent",
    eid_adha: "festival-crescent",
    muharram: "festival-crescent",
    milad: "festival-crescent",
    christmas: "festival-cross",
    good_friday: "festival-cross",
    easter: "festival-cross",
    vaisakhi: "festival-khanda",
    gurpurab: "festival-khanda",
    buddha_purnima: "festival-wheel",
    mahavir_jayanti: "festival-ahimsa",
    new_year: "festival-calendar",
    unmapped: "festival-calendar",
  }))
    assert.equal(festivalSymbol({ festival_id }), symbol);
});

test("every published festival date has artwork, provenance and valid civil date", () => {
  for (const row of [...data.records, ...data.festival_calendar]) {
    if (!row.festival) continue;
    assert.ok(data.festival_art[row.festival_id], row.name);
    const date = new Date(`${row.date}T00:00:00Z`);
    assert.equal(date.toISOString().slice(0, 10), row.date);
    assert.equal(row.reviewed, "2026-10-11");
    assert.ok(row.note.length > 0);
  }
});

test("regional festival associations follow the selected year and last available local year", () => {
  const annual = {
    ...data,
    festival_regions_by_year: {
      "Tamil Nadu": { 2025: ["holi"], 2026: ["diwali"] },
    },
  };
  assert.equal(rows("Tamil Nadu", 2026, "holi").length, 0);
  const selected = calendarRecords(annual, "Tamil Nadu");
  assert.equal(
    selected.some((row) => row.festival_id === "holi"),
    false,
  );
  assert.equal(
    selected.filter(
      (row) => row.festival_id === "diwali" && row.date.startsWith("2027"),
    ).length,
    1,
  );
});
