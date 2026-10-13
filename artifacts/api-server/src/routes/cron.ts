import type { Request, Response } from "express";
import { logger } from "../lib/logger";
import { cronAuthorized } from "../lib/cron-auth";
import { runWarrantyScan } from "../lib/warranty-scan";
import { sendDueCustodyBatches } from "../lib/custody-ops";

export { cronAuthorized } from "../lib/cron-auth";

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

export async function custodyCronHandler(req: Request, res: Response): Promise<void> {
  if (!cronAuthorized(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const result = await sendDueCustodyBatches();
    res.json({ status: "ok", ...result });
  } catch (err) {
    logger.error({ err }, "custody cron failed");
    res.status(500).json({ error: "Custody send failed" });
  }
}
