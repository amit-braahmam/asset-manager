import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_PAGE_SIZE, PAGE_SIZES, pageSlice } from "./paging";

describe("page sizes", () => {
  it("defaults to 10 and steps from 20 to 100 by 15", () => {
    assert.equal(DEFAULT_PAGE_SIZE, 10);
    assert.deepEqual([...PAGE_SIZES], [10, 20, 35, 50, 65, 80, 95, 100]);
  });
});

describe("pageSlice", () => {
  const rows = Array.from({ length: 23 }, (_, index) => index + 1);

  it("returns the first page by default", () => {
    const page = pageSlice(rows, 1, 10);
    assert.deepEqual(page.items, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    assert.equal(page.total, 23);
    assert.equal(page.pages, 3);
  });

  it("clamps past the last page", () => {
    const page = pageSlice(rows, 99, 10);
    assert.deepEqual(page.items, [21, 22, 23]);
    assert.equal(page.page, 3);
  });

  it("handles an empty list", () => {
    const page = pageSlice([], 2, 20);
    assert.deepEqual(page.items, []);
    assert.equal(page.total, 0);
    assert.equal(page.page, 1);
    assert.equal(page.pages, 1);
  });
});
