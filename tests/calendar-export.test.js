import test from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdirSync } from "node:fs";
import {
  createICS,
  googleCalendarUrl,
  foldLine,
} from "../public/calendar-export.js";

const plan = {
  id: "8b4be4a5-5a47-4f97-9861-6b4f36306553",
  category: "trains",
  categoryLabel: "Trains",
  title: "Train booking opens — சென்னை → Madurai; 50% & friends",
  event_date: "2026-12-15",
  origin: "Chennai, MAS",
  destination: "Madurai",
  service: "AC\nExpress",
  source: "https://contents.irctc.co.in/en/tatkal_faq.pdf",
  result: {
    opening_date: "2026-12-13",
    opening_time: "10:00",
    opening_at: "2026-12-13T10:00:00+05:30",
    rule: "Tatkal one day before origin departure",
    verification_status: "Verified policy",
  },
};
test("chosen reminder time is exported without changing provider opening time", () => {
  const p = { ...plan, reminder_time: "09:15" };
  const url = new URL(googleCalendarUrl(p));
  assert.equal(
    url.searchParams.get("dates"),
    "20261213T034500Z/20261213T040000Z",
  );
  assert.match(
    url.searchParams.get("details"),
    /Booking opens: 2026-12-13 10:00/,
  );
  assert.match(url.searchParams.get("details"), /chosen reminder time: 09:15/);
  assert.match(url.searchParams.get("text"), /booking reminder/);
  assert.match(createICS(p), /DTSTART:20261213T034500Z/);
  assert.equal(plan.result.opening_time, "10:00");
});
test("unknown provider time can have an explicit timed reminder", () => {
  const p = {
    ...plan,
    reminder_time: "08:00",
    result: { ...plan.result, opening_time: null },
  };
  assert.equal(
    new URL(googleCalendarUrl(p)).searchParams.get("dates"),
    "20261213T023000Z/20261213T024500Z",
  );
  assert.match(
    new URL(googleCalendarUrl(p)).searchParams.get("details"),
    /time unknown/,
  );
  assert.throws(() => createICS({ ...p, reminder_time: "24:00" }));
});
test("Google event uses opening, UTC timestamps, timezone and all supported fields", () => {
  const url = new URL(googleCalendarUrl(plan));
  assert.equal(url.hostname, "www.google.com");
  assert.equal(url.pathname, "/calendar/render");
  assert.equal(url.searchParams.get("action"), "TEMPLATE");
  assert.equal(url.searchParams.get("ctz"), "Asia/Kolkata");
  assert.equal(
    url.searchParams.get("dates"),
    "20261213T043000Z/20261213T044500Z",
  );
  assert.equal(url.searchParams.get("stz"), "Asia/Kolkata");
  assert.equal(url.searchParams.get("etz"), "Asia/Kolkata");
  assert.equal(
    url.searchParams.get("text"),
    "BookDay: Trains booking opens — " + plan.title,
  );
  assert.equal(url.searchParams.get("location"), "Chennai, MAS → Madurai");
  assert.match(
    url.searchParams.get("details"),
    /Journey\/event date: 2026-12-15/,
  );
  assert.equal(url.searchParams.has("reminders"), false);
});
test("unknown time uses exclusive all-day dates across year boundary", () => {
  const p = {
    ...plan,
    result: {
      ...plan.result,
      opening_date: "2026-12-31",
      opening_time: null,
      opening_at: null,
    },
  };
  assert.equal(
    new URL(googleCalendarUrl(p)).searchParams.get("dates"),
    "20261231/20270101",
  );
  assert.match(
    createICS(p),
    /DTSTART;VALUE=DATE:20261231\r\nDTEND;VALUE=DATE:20270101/,
  );
  mkdirSync("output", { recursive: true });
  writeFileSync("output/all-day.ics", createICS(p));
});
test("Unicode ICS, escaping, octet folding, alarms, CRLF and stable UID", () => {
  const ics = createICS(plan, [0, 60, 1440], new Date("2026-10-11T00:00:00Z"));
  for (const line of ics.split("\r\n"))
    assert.ok(new TextEncoder().encode(line).length <= 75);
  assert.equal(ics.replaceAll("\r\n", "").includes("\n"), false);
  assert.equal((ics.match(/BEGIN:VALARM/g) || []).length, 3);
  assert.match(ics, /TRIGGER:-PT1440M/);
  assert.match(ics, /DTSTART:20261213T043000Z/);
  assert.match(ics, /UID:8b4be4a5-5a47-4f97-9861-6b4f36306553@bookday.app/);
  assert.match(ics, /Chennai\\, MAS/);
  mkdirSync("output", { recursive: true });
  writeFileSync("output/timed.ics", ics);
});
test("folds UTF-8 code points without splitting characters", () => {
  const value = "SUMMARY:" + "தமிழ்".repeat(40),
    folded = foldLine(value);
  assert.equal(folded.replaceAll("\r\n ", ""), value);
  for (const line of folded.split("\r\n"))
    assert.ok(Buffer.byteLength(line) <= 75);
});
test("unknown opening cannot export; invalid alarms reject", () => {
  assert.throws(() => createICS({ ...plan, result: { opening_date: null } }));
  assert.throws(() => createICS(plan, [-1]));
});
