import type { Request, Response } from "express";
import { logger } from "../lib/logger";
import { runWarrantyScan } from "../lib/warranty-scan";

export function cronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = req.headers.authorization ?? "";
  return header === `Bearer ${secret}`;
}

export async function warrantyCronHandler(req: Request, res: Response): Promise<void> {
  if (!cronAuthorized(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const result = await runWarrantyScan();
    res.json({ status: "ok", ...result });
  } catch (err) {
    logger.error({ err }, "warranty cron failed");
    res.status(500).json({ error: "Warranty scan failed" });
  }
}
