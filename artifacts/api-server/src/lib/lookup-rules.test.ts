import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canCreateInGroup,
  canDeactivateOption,
  deleteLookupError,
  slugifyLookupValue,
  valueFromLabel,
} from "./lookup-rules";

describe("lookup rules", () => {
  it("slugifies custom option values except inventory categories", () => {
    assert.equal(slugifyLookupValue(" In Repair "), "in_repair");
    assert.equal(valueFromLabel("inventory_status", "On Hold"), "on_hold");
    assert.equal(valueFromLabel("inventory_category", " Lab Kit "), "Lab Kit");
  });

  it("blocks adding or deleting maintenance scope options", () => {
    assert.equal(canCreateInGroup("maintenance_scope"), false);
    assert.equal(canCreateInGroup("inventory_category"), true);
    assert.equal(deleteLookupError({ system: false, group: "maintenance_scope" }, 0), "Scope options cannot be deleted.");
  });

  it("blocks deleting system keys and in-use custom options", () => {
    assert.equal(deleteLookupError({ system: true, group: "inventory_status" }, 0), "System options cannot be deleted.");
    assert.equal(deleteLookupError({ system: false, group: "inventory_category" }, 3), "This option is still in use.");
    assert.equal(deleteLookupError({ system: false, group: "inventory_category" }, 0), null);
    assert.equal(canDeactivateOption({ system: true }), false);
    assert.equal(canDeactivateOption({ system: false }), true);
  });
});
