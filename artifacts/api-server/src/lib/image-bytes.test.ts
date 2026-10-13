import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sniffImageContentType } from "./image-bytes";

describe("sniffImageContentType", () => {
  it("detects jpeg png gif webp and rejects junk", () => {
    assert.equal(sniffImageContentType(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), "image/jpeg");
    assert.equal(
      sniffImageContentType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])),
      "image/png",
    );
    assert.equal(sniffImageContentType(Buffer.from("GIF89a....")), "image/gif");
    const webp = Buffer.alloc(12);
    Buffer.from("RIFF").copy(webp, 0);
    Buffer.from("WEBP").copy(webp, 8);
    assert.equal(sniffImageContentType(webp), "image/webp");
    assert.equal(sniffImageContentType(Buffer.from("not-an-image")), null);
  });
});
