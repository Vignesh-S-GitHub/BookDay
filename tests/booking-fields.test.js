import test from "node:test";
import assert from "node:assert/strict";
import { bookingFields } from "../public/booking-fields.js";
import { destinations } from "../public/destinations.js";

test("all 14 categories have purpose-specific date, location and service fields", () => {
  assert.equal(Object.keys(bookingFields).length, 14);
  for (const [id, schema] of Object.entries(bookingFields)) {
    assert.ok(schema.date && schema.service, id);
    assert.ok(schema.route || schema.place, id);
    assert.equal(
      Boolean(schema.route),
      ["trains", "flights", "buses"].includes(id),
    );
  }
  assert.equal(bookingFields.hotels.place, "Place");
  assert.equal(bookingFields.hotels.date, "Check-in Date");
  assert.equal(bookingFields.hotels.nights, true);
});
test("every state/UT has distinct scenery and destination-specific copy", () => {
  assert.equal(Object.keys(destinations).length, 36);
  assert.equal(
    new Set(Object.values(destinations).map((d) => d.image)).size,
    36,
  );
  for (const destination of Object.values(destinations))
    assert.ok(destination.subtitle);
  assert.equal(destinations["Tamil Nadu"].image, "home_india");
});
