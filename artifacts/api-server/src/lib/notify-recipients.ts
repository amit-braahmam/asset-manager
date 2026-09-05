import { PENDING_USER_PREFIX } from "./auth-roles";
import type { UserRole } from "@workspace/db/schema";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim().toLowerCase();
  if (!trimmed || !EMAIL_RE.test(trimmed)) return null;
  return trimmed;
}

export function uniqueValidEmails(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map(normalizeEmail).filter((value): value is string => value !== null))];
}

export function isActiveAppUser(id: string): boolean {
  return !id.startsWith(PENDING_USER_PREFIX);
}

export function technicianMatches(
  technician: string,
  user: { email: string; name: string },
): boolean {
  const needle = technician.trim().toLowerCase();
  if (!needle) return false;
  return user.email.trim().toLowerCase() === needle || user.name.trim().toLowerCase() === needle;
}

export type WarrantyWindow = "warranty_30d" | "warranty_14d" | "warranty_7d" | "warranty_expired";

export function warrantyDaysRemaining(
  warrantyEnd: string,
  today: Date = new Date(),
): number | null {
  const end = Date.parse(`${warrantyEnd}T00:00:00.000Z`);
  if (Number.isNaN(end)) return null;
  const startOfToday = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.round((end - startOfToday) / 86_400_000);
}

/** Inclusive buckets so a missed daily cron still fires the next remaining window once. */
export function warrantyWindow(
  warrantyEnd: string,
  today: Date = new Date(),
): WarrantyWindow | null {
  const days = warrantyDaysRemaining(warrantyEnd, today);
  if (days == null) return null;
  if (days <= 0) return "warranty_expired";
  if (days <= 7) return "warranty_7d";
  if (days <= 14) return "warranty_14d";
  if (days <= 30) return "warranty_30d";
  return null;
}

export const OPERATIONAL_ROLES: UserRole[] = ["admin", "manager"];
export const REPORT_ROLES: UserRole[] = ["admin", "auditor"];
