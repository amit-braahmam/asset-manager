import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { notifySafely } from "./notify-safe";

describe("notifySafely", () => {
  it("does not throw when the send task fails", async () => {
    await notifySafely("test", async () => {
      throw new Error("resend down");
    });
    assert.ok(true);
  });
});
