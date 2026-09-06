import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { paged } from "./paging";

describe("paged", () => {
  it("slices a page and reports total", () => {
    const result = paged([1, 2, 3, 4, 5], 2, 2);
    assert.deepEqual(result.items, [3, 4]);
    assert.equal(result.total, 5);
    assert.equal(result.page, 2);
    assert.equal(result.pageSize, 2);
  });

  it("returns an empty page past the end", () => {
    const result = paged([1, 2], 3, 10);
    assert.deepEqual(result.items, []);
    assert.equal(result.total, 2);
  });
});
