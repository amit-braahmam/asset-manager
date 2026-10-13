import { timingSafeEqual } from "node:crypto";
import type { Request } from "express";

function safeEqualString(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function cronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = req.headers.authorization ?? "";
  const expected = `Bearer ${secret}`;
  return safeEqualString(header, expected);
}
