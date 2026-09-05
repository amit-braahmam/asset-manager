import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HELP_GUIDES, HELP_SECTIONS, helpSectionFromPath } from "./help-guides";

describe("help guides", () => {
  it("covers every promised section", () => {
    assert.deepEqual(HELP_GUIDES.map((guide) => guide.id), [...HELP_SECTIONS]);
    for (const guide of HELP_GUIDES) {
      assert.ok(guide.title.length > 0);
      assert.ok(guide.steps.length >= 3);
    }
  });

  it("opens the guide that matches the current page", () => {
    assert.equal(helpSectionFromPath("/inventory"), "inventory");
    assert.equal(helpSectionFromPath("/assets/abc"), "inventory");
    assert.equal(helpSectionFromPath("/maintenance"), "maintenance");
    assert.equal(helpSectionFromPath("/directory"), "people");
    assert.equal(helpSectionFromPath("/team"), "team");
    assert.equal(helpSectionFromPath("/reports/r1"), "reports");
    assert.equal(helpSectionFromPath("/workspace"), "inventory");
  });
});
