import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { sniffImageContentType } from "./image-bytes";
import { logger } from "./logger";

const MAX_BYTES = 5 * 1024 * 1024;

export function decodeImagePayload(input: {
  contentType: string;
  contentBase64: string;
}): { bytes: Buffer; contentType: string } {
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
  const sniffed = sniffImageContentType(bytes);
  if (!sniffed) {
    throw new Error("Only JPEG, PNG, WebP, or GIF images are allowed.");
  }
  return { bytes, contentType: sniffed };
}

function localDir() {
  return process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
}

function blobToken() {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  return token || undefined;
}

function shouldUseBlob() {
  return Boolean(
    process.env.VERCEL ||
      blobToken() ||
      process.env.BLOB_STORE_ID?.trim(),
  );
}

function blobAuth() {
  const token = blobToken();
  return token ? { token } : {};
}

async function putBlob(id: string, bytes: Buffer, contentType: string) {
  const { put } = await import("@vercel/blob");
  const blob = await put(`attachments/${id}`, bytes, {
    access: "private",
    contentType,
    addRandomSuffix: false,
    ...blobAuth(),
  });
  // App always serves through authenticated /api/attachments/:id/file
  return {
    url: `/api/attachments/${id}/file`,
    storageKey: `blob-private:${blob.pathname}`,
  };
}

export async function storeImage(
  id: string,
  bytes: Buffer,
  contentType: string,
): Promise<{ url: string; storageKey: string }> {
  if (shouldUseBlob()) {
    try {
      return await putBlob(id, bytes, contentType);
    } catch (err) {
      logger.error({ err }, "photo storage failed");
      if (process.env.VERCEL) {
        throw new Error(
          "Photo storage failed. Confirm the private Blob store is connected to this Vercel project.",
        );
      }
      throw new Error("Photo storage failed.");
    }
  }
  const dir = localDir();
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, id), bytes);
  return { url: `/api/attachments/${id}/file`, storageKey: `local:${id}` };
}

export async function readLocalImage(id: string): Promise<Buffer | null> {
  try {
    return await readFile(path.join(localDir(), id));
  } catch {
    return null;
  }
}

export async function readStoredImage(
  storageKey: string,
): Promise<{ bytes: Buffer; contentType?: string } | null> {
  if (storageKey.startsWith("local:")) {
    const bytes = await readLocalImage(storageKey.slice("local:".length));
    return bytes ? { bytes } : null;
  }

  if (storageKey.startsWith("blob-private:") && shouldUseBlob()) {
    const { get } = await import("@vercel/blob");
    const pathname = storageKey.slice("blob-private:".length);
    const result = await get(pathname, { access: "private", ...blobAuth() });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    const bytes = Buffer.from(await new Response(result.stream).arrayBuffer());
    return { bytes, contentType: result.blob.contentType };
  }

  // Legacy public Blob URLs stored as blob:https://...
  if (storageKey.startsWith("blob:") && shouldUseBlob()) {
    const url = storageKey.slice("blob:".length);
    try {
      const { get } = await import("@vercel/blob");
      const result = await get(url, { access: "public", ...blobAuth() });
      if (result?.statusCode === 200 && result.stream) {
        const bytes = Buffer.from(await new Response(result.stream).arrayBuffer());
        return { bytes, contentType: result.blob.contentType };
      }
    } catch {
      // fall through to fetch
    }
    const response = await fetch(url);
    if (!response.ok) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    return { bytes, contentType: response.headers.get("content-type") ?? undefined };
  }

  return null;
}

export async function removeStoredImage(storageKey: string): Promise<void> {
  if (storageKey.startsWith("local:")) {
    try {
      await unlink(path.join(localDir(), storageKey.slice("local:".length)));
    } catch {
      // already gone
    }
    return;
  }
  if (storageKey.startsWith("blob-private:") && shouldUseBlob()) {
    const { del } = await import("@vercel/blob");
    await del(storageKey.slice("blob-private:".length), blobAuth());
    return;
  }
  if (storageKey.startsWith("blob:") && shouldUseBlob()) {
    const { del } = await import("@vercel/blob");
    await del(storageKey.slice("blob:".length), blobAuth());
  }
}

export function attachmentApiUrl(id: string): string {
  return `/api/attachments/${id}/file`;
}
