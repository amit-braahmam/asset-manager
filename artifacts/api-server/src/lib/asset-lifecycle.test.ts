import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AssignAssetBody,
  CreateAssetBody,
  UpdateAssetStatusBody,
} from "@workspace/api-zod";

const validAsset = {
  assetTag: "LT-1001",
  name: "MacBook Pro 14",
  category: "Laptop",
  manufacturer: "Apple",
  model: "MacBook Pro M3",
  serialNumber: "C02TEST1001",
  locationId: "loc-hq",
};

describe("asset lifecycle contracts", () => {
  it("accepts a complete create-asset payload", () => {
    const parsed = CreateAssetBody.parse(validAsset);
    assert.equal(parsed.status, "available");
    assert.equal(parsed.condition, "good");
  });

  it("rejects a create-asset payload missing required fields", () => {
    assert.throws(() => CreateAssetBody.parse({ name: "Incomplete" }));
  });

  it("requires person and location to assign", () => {
    const parsed = AssignAssetBody.parse({
      personId: "person-sarah",
      locationId: "loc-hq",
    });
    assert.equal(parsed.personId, "person-sarah");
    assert.throws(() => AssignAssetBody.parse({ personId: "person-sarah" }));
  });

  it("accepts a custom inventory status at the contract layer", () => {
    const parsed = UpdateAssetStatusBody.parse({ status: "on_hold" });
    assert.equal(parsed.status, "on_hold");
  });
});
