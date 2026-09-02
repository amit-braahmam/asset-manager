import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { reportPatchRejection } from "./report-workflow";

describe("reportPatchRejection", () => {
  it("locks finalized reports", () => {
    const result = reportPatchRejection("final", "final");
    assert.deepEqual(result, {
      status: 409,
      error: "Finalized reports cannot be modified.",
    });
  });

  it("allows forward workflow steps", () => {
    assert.equal(reportPatchRejection("in_preparation", "ready_for_review"), null);
    assert.equal(reportPatchRejection("ready_for_review", "final"), null);
    assert.equal(reportPatchRejection("in_preparation", "final"), null);
  });

  it("rejects backward workflow steps", () => {
    const result = reportPatchRejection("ready_for_review", "in_preparation");
    assert.equal(result?.status, 400);
    assert.match(result?.error ?? "", /Invalid workflow transition/);
  });

  it("allows same-stage edits before final", () => {
    assert.equal(reportPatchRejection("in_preparation", undefined), null);
    assert.equal(reportPatchRejection("in_preparation", "in_preparation"), null);
  });
});
