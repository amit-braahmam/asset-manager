import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export function decodeImagePayload(input: {
  contentType: string;
  contentBase64: string;
}): { bytes: Buffer; contentType: string } {
  const contentType = input.contentType.split(";")[0].trim().toLowerCase();
  if (!ALLOWED_TYPES.has(contentType)) {
    throw new Error("Only JPEG, PNG, WebP, or GIF images are allowed.");
  }
  const raw = input.contentBase64.includes(",")
    ? input.contentBase64.slice(input.contentBase64.indexOf(",") + 1)
    : input.contentBase64;
  const bytes = Buffer.from(raw, "base64");
  if (!bytes.length) {
    throw new Error("The image file is empty.");
  }
  if (bytes.length > MAX_BYTES) {
    throw new Error("Images must be 5 MB or smaller.");
  }
  return { bytes, contentType };
}

function localDir() {
  return process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
}

export async function storeImage(
  id: string,
  bytes: Buffer,
  contentType: string,
): Promise<{ url: string; storageKey: string }> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (token) {
    const { put } = await import("@vercel/blob");
    const blob = await put(`attachments/${id}`, bytes, {
      access: "public",
      contentType,
      token,
    });
    return { url: blob.url, storageKey: `blob:${blob.url}` };
  }
  const dir = localDir();
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, id);
  await writeFile(filePath, bytes);
  return { url: `/api/attachments/${id}/file`, storageKey: `local:${id}` };
}

export async function readLocalImage(id: string): Promise<Buffer | null> {
  try {
    return await readFile(path.join(localDir(), id));
  } catch {
    return null;
  }
}

export async function removeStoredImage(storageKey: string): Promise<void> {
  if (storageKey.startsWith("local:")) {
    const id = storageKey.slice("local:".length);
    try {
      await unlink(path.join(localDir(), id));
    } catch {
      // already gone
    }
    return;
  }
  if (storageKey.startsWith("blob:") && process.env.BLOB_READ_WRITE_TOKEN) {
    const { del } = await import("@vercel/blob");
    await del(storageKey.slice("blob:".length), {
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
  }
}
