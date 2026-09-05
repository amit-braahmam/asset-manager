import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { GetPublicCustodyParams, RespondPublicCustodyBody, RespondPublicCustodyParams } from "@workspace/api-zod";
import { seedReady } from "../lib/seed";
import { getPublicCustody, respondPublicCustody } from "../lib/custody-ops";

const hits = new Map<string, { count: number; resetAt: number }>();

function publicLimit(req: Request, res: Response, next: NextFunction) {
  const key = req.ip || "unknown";
  const now = Date.now();
  const current = hits.get(key);
  if (!current || current.resetAt < now) {
    hits.set(key, { count: 1, resetAt: now + 60_000 });
    next();
    return;
  }
  current.count += 1;
  if (current.count > 30) {
    res.status(429).json({ error: "Too many confirmation attempts. Try again in a minute." });
    return;
  }
  next();
}

const router: IRouter = Router();

router.get("/custody/:token", publicLimit, async (req, res) => {
  await seedReady;
  const { token } = GetPublicCustodyParams.parse(req.params);
  const result = await getPublicCustody(token);
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  res.json(result.view);
});

router.post("/custody/:token", publicLimit, async (req, res) => {
  await seedReady;
  const { token } = RespondPublicCustodyParams.parse(req.params);
  const body = RespondPublicCustodyBody.parse(req.body);
  const result = await respondPublicCustody(token, body.items);
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  res.json(result.view);
});

export default router;
