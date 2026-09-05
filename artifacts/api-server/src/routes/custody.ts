import { Router, type IRouter } from "express";
import {
  CreateCustodyCheckBody,
  GetCustodyCheckParams,
  RemindCustodyCheckParams,
  SendCustodyCheckBatchParams,
  UpdateCustodyCheckBody,
} from "@workspace/api-zod";
import { requireRoles } from "../lib/auth";
import { seedReady } from "../lib/seed";
import {
  closeCustodyCheck,
  createCustodyCheck,
  getCustodyCheck,
  listCustodyChecks,
  remindCustodyCheck,
  sendCustodyBatch,
} from "../lib/custody-ops";

const router: IRouter = Router();

router.get("/custody-checks", requireRoles("admin", "auditor", "manager"), async (_req, res) => {
  await seedReady;
  res.json(await listCustodyChecks());
});

router.post("/custody-checks", requireRoles("admin", "auditor"), async (req, res) => {
  await seedReady;
  const body = CreateCustodyCheckBody.parse(req.body);
  const created = await createCustodyCheck({
    title: body.title,
    dueAt: body.dueAt,
    batchSize: body.batchSize,
    cadence: body.cadence,
    locationId: body.locationId,
    departmentId: body.departmentId,
    createdBy: req.appUser!.id,
  });
  if (!created.ok) {
    res.status(created.status).json({ error: created.error });
    return;
  }
  res.status(201).json(created.check);
});

router.get("/custody-checks/:checkId", requireRoles("admin", "auditor", "manager"), async (req, res) => {
  await seedReady;
  const { checkId } = GetCustodyCheckParams.parse(req.params);
  const check = await getCustodyCheck(checkId);
  if (!check) {
    res.status(404).json({ error: "Custody check not found" });
    return;
  }
  res.json(check);
});

router.patch("/custody-checks/:checkId", requireRoles("admin", "auditor"), async (req, res) => {
  await seedReady;
  const { checkId } = GetCustodyCheckParams.parse(req.params);
  UpdateCustodyCheckBody.parse(req.body);
  const closed = await closeCustodyCheck(checkId);
  if (!closed) {
    res.status(404).json({ error: "Custody check not found" });
    return;
  }
  res.json(closed);
});

router.post("/custody-checks/:checkId/send", requireRoles("admin", "auditor"), async (req, res) => {
  await seedReady;
  const { checkId } = SendCustodyCheckBatchParams.parse(req.params);
  const result = await sendCustodyBatch(checkId, { ignoreCadence: true });
  if (!result) {
    res.status(404).json({ error: "Custody check not found" });
    return;
  }
  res.json(result);
});

router.post("/custody-checks/:checkId/remind", requireRoles("admin", "auditor"), async (req, res) => {
  await seedReady;
  const { checkId } = RemindCustodyCheckParams.parse(req.params);
  const check = await remindCustodyCheck(checkId);
  if (!check) {
    res.status(404).json({ error: "Custody check not found" });
    return;
  }
  res.json(check);
});

export default router;
