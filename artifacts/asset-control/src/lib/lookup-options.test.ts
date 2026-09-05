import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { LookupOption } from "@workspace/api-client-react";
import { catalogRows, lookupLabel, lookupOptions } from "./lookup-options.ts";

const rows: LookupOption[] = [
  { id: "1", group: "inventory_category", value: "Laptop", label: "Laptop", sortOrder: 10, active: true, system: true, usageCount: 4 },
  { id: "2", group: "inventory_category", value: "Dock", label: "Dock", sortOrder: 20, active: false, system: false, usageCount: 1 },
  { id: "3", group: "inventory_status", value: "available", label: "Ready", sortOrder: 10, active: true, system: true, usageCount: 2 },
];

describe("lookupOptions", () => {
  it("hides inactive custom options unless they are still on a record", () => {
    const active = lookupOptions(rows, "inventory_category");
    assert.ok(active.some((option) => option.value === "Laptop"));
    assert.ok(active.some((option) => option.value === "Monitor"));
    assert.ok(!active.some((option) => option.value === "Dock"));
    const withLive = lookupOptions(rows, "inventory_category", ["Dock"]);
    assert.ok(withLive.some((option) => option.value === "Dock"));
  });

  it("falls back to the shipped lists when the catalog is empty", () => {
    const options = lookupOptions(undefined, "inventory_status");
    assert.deepEqual(
      options.map((option) => option.value),
      ["available", "assigned", "in_repair", "rma", "retired", "lost"],
    );
  });

  it("keeps shipped inventory statuses when the catalog only has extras", () => {
    const options = lookupOptions([
      {
        id: "4",
        group: "inventory_status",
        value: "on_hold",
        label: "On hold",
        sortOrder: 70,
        active: true,
        system: false,
        usageCount: 0,
      },
    ], "inventory_status");
    assert.deepEqual(
      options.map((option) => option.value),
      ["available", "assigned", "in_repair", "rma", "retired", "lost", "on_hold"],
    );
  });
});

describe("catalogRows", () => {
  it("always lists system inventory statuses in Directory", () => {
    const listed = catalogRows([], "inventory_status");
    assert.deepEqual(
      listed.map((option) => option.value),
      ["available", "assigned", "in_repair", "rma", "retired", "lost"],
    );
    assert.ok(listed.every((option) => option.system && option.active));
  });
});

describe("lookupLabel", () => {
  it("uses the catalog label and falls back to the shipped name", () => {
    assert.equal(lookupLabel(rows, "inventory_status", "available"), "Ready");
    assert.equal(lookupLabel(rows, "inventory_status", "assigned"), "Assigned");
  });
});
