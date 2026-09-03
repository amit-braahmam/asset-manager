import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emailEnabled } from "./email";

describe("emailEnabled", () => {
  it("is off without a key, and when EMAIL_ENABLED=false", () => {
    const key = process.env.RESEND_API_KEY;
    const flag = process.env.EMAIL_ENABLED;
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_ENABLED;
    assert.equal(emailEnabled(), false);
    process.env.RESEND_API_KEY = "re_test";
    assert.equal(emailEnabled(), true);
    process.env.EMAIL_ENABLED = "false";
    assert.equal(emailEnabled(), false);
    if (key === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = key;
    if (flag === undefined) delete process.env.EMAIL_ENABLED;
    else process.env.EMAIL_ENABLED = flag;
  });
});
