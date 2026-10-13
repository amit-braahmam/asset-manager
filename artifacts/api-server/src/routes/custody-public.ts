import { Router, type IRouter } from "express";
import { GetPublicCustodyParams, RespondPublicCustodyBody, RespondPublicCustodyParams } from "@workspace/api-zod";
import { seedReady } from "../lib/seed";
import { getPublicCustody, respondPublicCustody } from "../lib/custody-ops";
import { publicCustodyRateLimit } from "../lib/rate-limit";

const router: IRouter = Router();

router.get("/custody/:token", publicCustodyRateLimit, async (req, res) => {
  await seedReady;
  const { token } = GetPublicCustodyParams.parse(req.params);
  const result = await getPublicCustody(token);
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  res.json(result.view);
});

router.post("/custody/:token", publicCustodyRateLimit, async (req, res) => {
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
