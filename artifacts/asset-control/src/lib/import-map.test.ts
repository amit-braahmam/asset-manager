import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ASSET_FIELDS,
  PERSON_FIELDS,
  buildInventoryTemplateCsv,
  buildPeopleTemplateCsv,
  guessAssetMapping,
  guessPersonMapping,
  inventoryTemplateHeaders,
  mappedAssetPayloads,
  mappedPersonPayloads,
  mapStatus,
  peopleTemplateHeaders,
  previewAssetRows,
  previewPersonRows,
} from "./import-map.ts";

const assetHeaders = [
  "Asset Tag ID",
  "Name",
  "Description",
  "Manufacturer",
  "Brand",
  "Model",
  "Serial Number",
  "Location",
  "Status",
];

const locations = [{ id: "loc-hq", name: "HQ" }, { id: "loc-lab", name: "Lab" }];
const departments = [{ id: "dept-it", name: "IT" }, { id: "dept-ops", name: "Operations" }];

describe("import column mapping", () => {
  it("maps AssetTiger-style inventory headers and ignores Brand and Description-as-name", () => {
    const mapping = guessAssetMapping(assetHeaders);
    assert.equal(mapping.assetTag, "Asset Tag ID");
    assert.equal(mapping.name, "Name");
    assert.equal(mapping.description, "Description");
    assert.equal(mapping.manufacturer, "Manufacturer");
    assert.equal(mapping.model, "Model");
    assert.equal(mapping.serialNumber, "Serial Number");
    assert.equal(mapping.location, "Location");
    assert.equal(mapping.status, "Status");
    assert.equal(mapping.category, "");
  });

  it("does not use Description as the asset name when Name is missing", () => {
    const mapping = guessAssetMapping(["Asset Tag ID", "Description", "Manufacturer", "Model", "Serial Number"]);
    assert.equal(mapping.name, "");
    assert.equal(mapping.description, "Description");
  });

  it("maps people name, email, and department headers", () => {
    const mapping = guessPersonMapping(["Full Name", "Email Address", "Department"]);
    assert.equal(mapping.name, "Full Name");
    assert.equal(mapping.email, "Email Address");
    assert.equal(mapping.department, "Department");
  });
});

describe("inventory import preview", () => {
  const mapping = guessAssetMapping(assetHeaders);

  it("skips rows missing required fields", () => {
    const preview = previewAssetRows(
      [{ "Asset Tag ID": "A-1", Name: "", Description: "A monitor", Manufacturer: "Dell", Brand: "Dell", Model: "U2720", "Serial Number": "SN-1", Location: "HQ", Status: "Available" }],
      mapping,
      locations,
      new Set(),
      new Set(),
      "loc-lab",
    );
    assert.equal(preview[0].status, "skipped");
    assert.match(preview[0].reason ?? "", /required/);
  });

  it("skips duplicate tags in the file and serials already in inventory", () => {
    const preview = previewAssetRows(
      [
        { "Asset Tag ID": "A-1", Name: "Laptop", Description: "", Manufacturer: "Dell", Brand: "", Model: "XPS", "Serial Number": "SN-1", Location: "HQ", Status: "Assigned" },
        { "Asset Tag ID": "A-1", Name: "Laptop 2", Description: "", Manufacturer: "Dell", Brand: "", Model: "XPS", "Serial Number": "SN-2", Location: "HQ", Status: "Available" },
        { "Asset Tag ID": "A-3", Name: "Dock", Description: "", Manufacturer: "Dell", Brand: "", Model: "WD19", "Serial Number": "EXISTING", Location: "HQ", Status: "Available" },
      ],
      mapping,
      locations,
      new Set(),
      new Set(["existing"]),
      "loc-lab",
    );
    assert.equal(preview[0].status, "ready");
    assert.equal(preview[1].status, "skipped");
    assert.match(preview[1].reason ?? "", /tag already exists/);
    assert.equal(preview[2].status, "skipped");
    assert.match(preview[2].reason ?? "", /serial number already exists/);
  });

  it("matches location names case-insensitively and uses the default for unmatched names", () => {
    const preview = previewAssetRows(
      [
        { "Asset Tag ID": "A-1", Name: "Laptop", Description: "", Manufacturer: "Dell", Brand: "", Model: "XPS", "Serial Number": "SN-1", Location: "hq", Status: "Available" },
        { "Asset Tag ID": "A-2", Name: "Phone", Description: "", Manufacturer: "Apple", Brand: "", Model: "14", "Serial Number": "SN-2", Location: "Warehouse", Status: "Available" },
      ],
      mapping,
      locations,
      new Set(),
      new Set(),
      "loc-lab",
    );
    assert.equal(preview[0].status, "ready");
    assert.equal(preview[1].status, "ready");
    const payloads = mappedAssetPayloads(
      [
        { "Asset Tag ID": "A-1", Name: "Laptop", Description: "Work laptop", Manufacturer: "Dell", Brand: "", Model: "XPS", "Serial Number": "SN-1", Location: "hq", Status: "Assigned" },
        { "Asset Tag ID": "A-2", Name: "Phone", Description: "", Manufacturer: "Apple", Brand: "", Model: "14", "Serial Number": "SN-2", Location: "Warehouse", Status: "Available" },
      ],
      mapping,
      locations,
      "loc-lab",
      new Set([2, 3]),
    );
    assert.equal(payloads[0].locationId, "loc-hq");
    assert.equal(payloads[0].status, "available");
    assert.equal(payloads[0].description, "Work laptop");
    assert.equal(payloads[1].locationId, "loc-lab");
  });
});

describe("inventory status mapping", () => {
  it("maps assigned to available and matches Directory labels", () => {
    assert.equal(mapStatus("Assigned"), "available");
    assert.equal(mapStatus("On Hold", [{ value: "on_hold", label: "On Hold" }]), "on_hold");
    assert.equal(mapStatus("mystery"), "available");
  });
});

describe("people import preview", () => {
  const mapping = guessPersonMapping(["Name", "Email", "Department"]);

  it("skips missing fields, unknown departments, and duplicate emails", () => {
    const preview = previewPersonRows(
      [
        { Name: "Ada", Email: "ada@example.com", Department: "IT" },
        { Name: "Ada Clone", Email: "ADA@example.com", Department: "IT" },
        { Name: "Sam", Email: "sam@example.com", Department: "Unknown" },
        { Name: "Pat", Email: "pat@example.com", Department: "Operations" },
        { Name: "", Email: "empty@example.com", Department: "IT" },
      ],
      mapping,
      departments,
      new Set(["pat@example.com"]),
    );
    assert.equal(preview[0].status, "ready");
    assert.equal(preview[1].status, "skipped");
    assert.match(preview[1].reason ?? "", /email already exists/);
    assert.equal(preview[2].status, "skipped");
    assert.match(preview[2].reason ?? "", /Department was not found/);
    assert.equal(preview[3].status, "skipped");
    assert.equal(preview[4].status, "skipped");
    const payloads = mappedPersonPayloads(
      [{ Name: "Ada", Email: "Ada@example.com", Department: "it" }],
      mapping,
      departments,
      new Set([2]),
    );
    assert.deepEqual(payloads, [{ name: "Ada", email: "ada@example.com", departmentId: "dept-it" }]);
  });
});

describe("import CSV templates", () => {
  it("uses inventory field labels that auto-map, including a Directory location name", () => {
    const headers = inventoryTemplateHeaders();
    assert.deepEqual(headers, ASSET_FIELDS.map((field) => field.label));
    const mapping = guessAssetMapping(headers);
    for (const field of ASSET_FIELDS) {
      assert.equal(mapping[field.key], field.label);
    }
    assert.match(buildInventoryTemplateCsv("HQ"), /SAMPLE-001/);
    assert.match(buildInventoryTemplateCsv("HQ"), /HQ/);
  });

  it("uses people field labels that auto-map, including a Directory department name", () => {
    const headers = peopleTemplateHeaders();
    assert.deepEqual(headers, PERSON_FIELDS.map((field) => field.label));
    const mapping = guessPersonMapping(headers);
    for (const field of PERSON_FIELDS) {
      assert.equal(mapping[field.key], field.label);
    }
    assert.match(buildPeopleTemplateCsv("IT"), /sample.person@example.com/);
    assert.match(buildPeopleTemplateCsv("IT"), /IT/);
  });
});
