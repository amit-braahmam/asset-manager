import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cronAuthorized } from "../routes/cron";
import type { Request } from "express";

describe("cronAuthorized", () => {
  it("rejects missing secret or mismatched bearer", () => {
    const prev = process.env.CRON_SECRET;
    delete process.env.CRON_SECRET;
    const req = { headers: { authorization: "Bearer nope" } } as unknown as Request;
    assert.equal(cronAuthorized(req), false);
    process.env.CRON_SECRET = "test-secret";
    assert.equal(cronAuthorized(req), false);
    const ok = { headers: { authorization: "Bearer test-secret" } } as unknown as Request;
    assert.equal(cronAuthorized(ok), true);
    if (prev === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = prev;
  });
});
