import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isActiveAppUser,
  normalizeEmail,
  technicianMatches,
  uniqueValidEmails,
  warrantyWindow,
} from "./notify-recipients";

describe("normalizeEmail / uniqueValidEmails", () => {
  it("lowercases and rejects invalid addresses", () => {
    assert.equal(normalizeEmail("  Amit@Braahmam.com "), "amit@braahmam.com");
    assert.equal(normalizeEmail("not-an-email"), null);
    assert.equal(normalizeEmail(""), null);
    assert.deepEqual(uniqueValidEmails(["A@X.com", "a@x.com", "bad", null]), ["a@x.com"]);
  });
});

describe("isActiveAppUser", () => {
  it("treats pending: ids as inactive", () => {
    assert.equal(isActiveAppUser("user_abc"), true);
    assert.equal(isActiveAppUser("pending:abc123"), false);
  });
});

describe("technicianMatches", () => {
  it("matches email or display name, case-insensitive", () => {
    const user = { email: "tech@example.com", name: "Priya Nair" };
    assert.equal(technicianMatches("tech@example.com", user), true);
    assert.equal(technicianMatches("PRIYA NAIR", user), true);
    assert.equal(technicianMatches("other", user), false);
  });
});

describe("warrantyWindow", () => {
  const today = new Date("2026-09-03T12:00:00.000Z");

  it("returns null when more than 30 days remain", () => {
    assert.equal(warrantyWindow("2026-12-01", today), null);
  });

  it("uses inclusive remaining-day buckets", () => {
    assert.equal(warrantyWindow("2026-10-03", today), "warranty_30d");
    assert.equal(warrantyWindow("2026-09-17", today), "warranty_14d");
    assert.equal(warrantyWindow("2026-09-10", today), "warranty_7d");
    assert.equal(warrantyWindow("2026-09-03", today), "warranty_expired");
    assert.equal(warrantyWindow("2026-08-01", today), "warranty_expired");
  });

  it("returns null for unparseable dates", () => {
    assert.equal(warrantyWindow("n/a", today), null);
  });
});
