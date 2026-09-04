import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseSpreadsheet } from "./import-file.ts";
import { buildInventoryTemplateCsv, buildPeopleTemplateCsv, guessAssetMapping, guessPersonMapping } from "./import-map.ts";

describe("spreadsheet parse", () => {
  it("reads csv headers and row values", async () => {
    const file = new File(
      ["Name,Email,Department\nAda Lovelace,ada@example.com,IT\n"],
      "people.csv",
      { type: "text/csv" },
    );
    const table = await parseSpreadsheet(file);
    assert.equal(table.fileName, "people.csv");
    assert.deepEqual(table.headers, ["Name", "Email", "Department"]);
    assert.equal(table.rows.length, 1);
    assert.equal(table.rows[0].Name, "Ada Lovelace");
    assert.equal(table.rows[0].Email, "ada@example.com");
    assert.equal(table.truncated, false);
  });

  it("parses the inventory template and auto-maps required columns", async () => {
    const file = new File([buildInventoryTemplateCsv("HQ")], "asset-manager-inventory-template.csv", { type: "text/csv" });
    const table = await parseSpreadsheet(file);
    const mapping = guessAssetMapping(table.headers);
    assert.equal(mapping.assetTag, "Asset tag");
    assert.equal(mapping.name, "Asset name");
    assert.equal(mapping.manufacturer, "Manufacturer");
    assert.equal(mapping.model, "Model");
    assert.equal(mapping.serialNumber, "Serial number");
    assert.equal(table.rows[0].Location, "HQ");
  });

  it("parses the people template and auto-maps required columns", async () => {
    const file = new File([buildPeopleTemplateCsv("IT")], "asset-manager-people-template.csv", { type: "text/csv" });
    const table = await parseSpreadsheet(file);
    const mapping = guessPersonMapping(table.headers);
    assert.equal(mapping.name, "Name");
    assert.equal(mapping.email, "Email");
    assert.equal(mapping.department, "Department");
    assert.equal(table.rows[0].Department, "IT");
  });
});
