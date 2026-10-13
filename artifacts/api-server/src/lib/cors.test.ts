import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { corsAllowsRequest, isAllowedCorsOrigin } from "./cors";

describe("CORS allowlist", () => {
  it("allows APP_URL and CORS_ORIGIN extras", () => {
    const prevApp = process.env.APP_URL;
    const prevCors = process.env.CORS_ORIGIN;
    const prevNode = process.env.NODE_ENV;
    process.env.APP_URL = "https://app.example.com";
    process.env.CORS_ORIGIN = "https://preview.example.com";
    process.env.NODE_ENV = "production";
    assert.equal(isAllowedCorsOrigin("https://app.example.com"), true);
    assert.equal(isAllowedCorsOrigin("https://preview.example.com"), true);
    assert.equal(isAllowedCorsOrigin("https://evil.vercel.app"), false);
    assert.equal(corsAllowsRequest(undefined), true);
    if (prevApp === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = prevApp;
    if (prevCors === undefined) delete process.env.CORS_ORIGIN;
    else process.env.CORS_ORIGIN = prevCors;
    if (prevNode === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prevNode;
  });

  it("allows localhost only outside production", () => {
    const prevNode = process.env.NODE_ENV;
    const prevLocal = process.env.ALLOW_LOCAL_CORS;
    delete process.env.ALLOW_LOCAL_CORS;
    process.env.NODE_ENV = "development";
    assert.equal(isAllowedCorsOrigin("http://localhost:5173"), true);
    process.env.NODE_ENV = "production";
    assert.equal(isAllowedCorsOrigin("http://localhost:5173"), false);
    process.env.ALLOW_LOCAL_CORS = "true";
    assert.equal(isAllowedCorsOrigin("http://localhost:5173"), true);
    if (prevNode === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prevNode;
    if (prevLocal === undefined) delete process.env.ALLOW_LOCAL_CORS;
    else process.env.ALLOW_LOCAL_CORS = prevLocal;
  });
});
