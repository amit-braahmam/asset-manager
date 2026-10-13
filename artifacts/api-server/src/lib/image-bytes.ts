const JPEG = Buffer.from([0xff, 0xd8, 0xff]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const GIF87 = Buffer.from("GIF87a");
const GIF89 = Buffer.from("GIF89a");
const WEBP_RIFF = Buffer.from("RIFF");
const WEBP_WEBP = Buffer.from("WEBP");

export type SniffedImageType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

/** Detect image type from magic bytes. Ignores the client Content-Type claim. */
export function sniffImageContentType(bytes: Buffer): SniffedImageType | null {
  if (bytes.length >= 3 && bytes.subarray(0, 3).equals(JPEG)) return "image/jpeg";
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(PNG)) return "image/png";
  if (bytes.length >= 6 && (bytes.subarray(0, 6).equals(GIF87) || bytes.subarray(0, 6).equals(GIF89))) {
    return "image/gif";
  }
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).equals(WEBP_RIFF) &&
    bytes.subarray(8, 12).equals(WEBP_WEBP)
  ) {
    return "image/webp";
  }
  return null;
}
