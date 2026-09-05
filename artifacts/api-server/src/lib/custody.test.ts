import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cadenceReady,
  clampBatchSize,
  hashCustodyToken,
  pickQueuedRecipients,
  tokenExpired,
} from "./custody";

describe("custody send rules", () => {
  it("clamps batch size between 1 and 100", () => {
    assert.equal(clampBatchSize(25), 25);
    assert.equal(clampBatchSize(0), 25);
    assert.equal(clampBatchSize(-4), 1);
    assert.equal(clampBatchSize(500), 100);
  });

  it("hashes tokens stably and not as plaintext", () => {
    const token = "preview-token";
    const hash = hashCustodyToken(token);
    assert.equal(hash.length, 64);
    assert.notEqual(hash, token);
    assert.equal(hash, hashCustodyToken(token));
  });

  it("waits for hour or day cadence before the next batch", () => {
    const now = new Date("2026-09-05T12:00:00Z");
    assert.equal(cadenceReady("hour", null, now), true);
    assert.equal(cadenceReady("hour", new Date("2026-09-05T11:00:00Z"), now), true);
    assert.equal(cadenceReady("hour", new Date("2026-09-05T11:30:00Z"), now), false);
    assert.equal(cadenceReady("day", new Date("2026-09-04T12:00:00Z"), now), true);
    assert.equal(cadenceReady("day", new Date("2026-09-05T08:00:00Z"), now), false);
  });

  it("takes only the next batch of queued recipients", () => {
    assert.deepEqual(pickQueuedRecipients(["a", "b", "c", "d"], 2), ["a", "b"]);
  });

  it("treats due tokens as expired", () => {
    const now = new Date("2026-09-05T12:00:00Z");
    assert.equal(tokenExpired(null, now), false);
    assert.equal(tokenExpired(new Date("2026-09-05T11:59:00Z"), now), true);
    assert.equal(tokenExpired(new Date("2026-09-05T12:01:00Z"), now), false);
  });
});
