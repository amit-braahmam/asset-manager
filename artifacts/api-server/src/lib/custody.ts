import { createHash, randomBytes } from "node:crypto";
import type { CustodyCadence } from "@workspace/db";

export const CUSTODY_TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000;
export const CUSTODY_MAX_SEND_ATTEMPTS = 3;
export const CUSTODY_MIN_BATCH = 1;
export const CUSTODY_MAX_BATCH = 100;
export const CUSTODY_DEFAULT_BATCH = 25;

export function clampBatchSize(value: number | undefined): number {
  const n = Number.isFinite(value) ? Math.floor(value as number) : CUSTODY_DEFAULT_BATCH;
  return Math.min(CUSTODY_MAX_BATCH, Math.max(CUSTODY_MIN_BATCH, n || CUSTODY_DEFAULT_BATCH));
}

export function hashCustodyToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newCustodyToken(): string {
  return randomBytes(32).toString("base64url");
}

export function cadenceReady(cadence: CustodyCadence, lastSendAt: Date | null, now = new Date()): boolean {
  if (!lastSendAt) return true;
  const waitMs = cadence === "day" ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000;
  return now.getTime() - lastSendAt.getTime() >= waitMs;
}

export function pickQueuedRecipients<T>(recipients: T[], batchSize: number): T[] {
  return recipients.slice(0, clampBatchSize(batchSize));
}

export function tokenExpired(expiresAt: Date | null, now = new Date()): boolean {
  return Boolean(expiresAt && expiresAt.getTime() <= now.getTime());
}
