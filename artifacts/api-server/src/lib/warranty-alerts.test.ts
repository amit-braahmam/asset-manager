import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { collectWarrantyAlerts, toWarrantyAlert } from "./warranty-alerts";

const today = new Date("2026-09-05T12:00:00.000Z");

describe("toWarrantyAlert", () => {
  it("returns null when warranty is missing or more than 30 days out", () => {
    assert.equal(toWarrantyAlert({ id: "1", assetTag: "A-1", name: "Laptop", warrantyEnd: null }, today), null);
    assert.equal(toWarrantyAlert({ id: "1", assetTag: "A-1", name: "Laptop", warrantyEnd: "2026-12-01" }, today), null);
  });

  it("keeps expired and near-term warranties", () => {
    const expired = toWarrantyAlert({ id: "1", assetTag: "A-1", name: "Laptop", warrantyEnd: "2026-08-01" }, today);
    assert.equal(expired?.window, "warranty_expired");
    assert.ok((expired?.daysRemaining ?? 0) < 0);

    const soon = toWarrantyAlert({ id: "2", assetTag: "A-2", name: "Phone", warrantyEnd: "2026-09-10" }, today);
    assert.equal(soon?.window, "warranty_7d");
    assert.equal(soon?.daysRemaining, 5);
  });
});

describe("collectWarrantyAlerts", () => {
  it("sorts soonest first and caps the list", () => {
    const alerts = collectWarrantyAlerts([
      { id: "c", assetTag: "C-3", name: "Dock", warrantyEnd: "2026-09-20" },
      { id: "a", assetTag: "A-1", name: "Laptop", warrantyEnd: "2026-08-01" },
      { id: "b", assetTag: "B-2", name: "Phone", warrantyEnd: "2026-09-10" },
      { id: "d", assetTag: "D-4", name: "Monitor", warrantyEnd: "2026-12-01" },
    ], today, 2);
    assert.deepEqual(alerts.map((alert) => alert.assetTag), ["A-1", "B-2"]);
  });
});
