import { Router, type IRouter } from "express";
import { asc, desc, eq } from "drizzle-orm";
import {
  CreateComplianceReportBody,
  GetComplianceReportParams,
  UpdateComplianceReportBody,
  UpdateComplianceReportParams,
  type ComplianceReport as ApiComplianceReport,
} from "@workspace/api-zod";
import {
  db,
  assetsTable,
  maintenanceTable,
  complianceReportsTable,
  COMPLIANCE_REPORT_STATUSES,
  type ComplianceReport as DbComplianceReport,
  type ComplianceReportStatus,
} from "@workspace/db";
import { randomUUID } from "node:crypto";
import { seedReady } from "../lib/seed";
import { requireRoles } from "../lib/auth";

const router: IRouter = Router();

const STAGE_ORDER: Record<ComplianceReportStatus, number> = {
  in_preparation: 0,
  ready_for_review: 1,
  final: 2,
};

// DB stores period bounds as date-only strings; the API contract uses Dates.
function toDateValue(value: string | null): Date | null {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

function toDateOnly(value: Date | null | undefined): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

function toReport(row: DbComplianceReport): ApiComplianceReport {
  return {
    id: row.id,
    title: row.title,
    status: row.status as ApiComplianceReport["status"],
    periodStart: toDateValue(row.periodStart),
    periodEnd: toDateValue(row.periodEnd),
    summary: row.summary,
    findings: row.findings,
    rootCauseNotes: row.rootCauseNotes,
    metrics: row.metrics,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    closedAt: row.closedAt,
  };
}

/** Point-in-time fleet metrics captured when a report is assembled. */
async function captureMetrics(): Promise<Record<string, number>> {
  const [assets, maintenance] = await Promise.all([
    db.select({ status: assetsTable.status }).from(assetsTable),
    db.select({ status: maintenanceTable.status }).from(maintenanceTable),
  ]);
  return {
    totalAssets: assets.length,
    assigned: assets.filter((a) => a.status === "assigned").length,
    inRepair: assets.filter((a) => a.status === "in_repair" || a.status === "rma").length,
    available: assets.filter((a) => a.status === "available").length,
    maintenanceOpen: maintenance.filter((m) => m.status !== "completed").length,
    maintenanceCompleted: maintenance.filter((m) => m.status === "completed").length,
  };
}

router.get("/reports", requireRoles("admin", "auditor"), async (_req, res) => {
  await seedReady;
  const rows = await db
    .select()
    .from(complianceReportsTable)
    .orderBy(desc(complianceReportsTable.updatedAt), asc(complianceReportsTable.title));
  res.json(rows.map(toReport));
});

router.post("/reports", requireRoles("admin", "auditor"), async (req, res) => {
  await seedReady;
  const body = CreateComplianceReportBody.parse(req.body);
  const now = new Date();
  const row = {
    id: `rpt-${randomUUID().slice(0, 8)}`,
    title: body.title,
    status: "in_preparation" as ComplianceReportStatus,
    periodStart: toDateOnly(body.periodStart),
    periodEnd: toDateOnly(body.periodEnd),
    summary: body.summary ?? "",
    findings: body.findings ?? "",
    rootCauseNotes: body.rootCauseNotes ?? "",
    metrics: await captureMetrics(),
    createdBy: req.appUser!.id,
    createdAt: now,
    updatedAt: now,
    closedAt: null,
  };
  await db.insert(complianceReportsTable).values(row);
  res.status(201).json(toReport(row as DbComplianceReport));
});

router.get("/reports/:reportId", requireRoles("admin", "auditor"), async (req, res) => {
  await seedReady;
  const { reportId } = GetComplianceReportParams.parse(req.params);
  const rows = await db
    .select()
    .from(complianceReportsTable)
    .where(eq(complianceReportsTable.id, reportId))
    .limit(1);
  if (rows.length === 0) {
    res.status(404).json({ error: "Report not found" });
    return;
  }
  res.json(toReport(rows[0]));
});

router.patch("/reports/:reportId", requireRoles("admin", "auditor"), async (req, res) => {
  await seedReady;
  const { reportId } = UpdateComplianceReportParams.parse(req.params);
  const body = UpdateComplianceReportBody.parse(req.body);

  const rows = await db
    .select()
    .from(complianceReportsTable)
    .where(eq(complianceReportsTable.id, reportId))
    .limit(1);
  if (rows.length === 0) {
    res.status(404).json({ error: "Report not found" });
    return;
  }
  const current = rows[0];

  // A finalized report is immutable.
  if (current.status === "final") {
    res.status(409).json({ error: "Finalized reports cannot be modified." });
    return;
  }

  // The workflow only moves forward: in_preparation -> ready_for_review -> final.
  if (body.status !== undefined && body.status !== current.status) {
    const from = STAGE_ORDER[current.status as ComplianceReportStatus];
    const to = STAGE_ORDER[body.status as ComplianceReportStatus];
    if (!COMPLIANCE_REPORT_STATUSES.includes(body.status) || to < from) {
      res.status(400).json({
        error: `Invalid workflow transition from ${current.status} to ${body.status}.`,
      });
      return;
    }
  }

  const now = new Date();
  const movingToFinal = body.status === "final" && current.status !== "final";
  await db
    .update(complianceReportsTable)
    .set({
      ...(body.title === undefined ? {} : { title: body.title }),
      ...(body.status === undefined ? {} : { status: body.status }),
      ...(body.periodStart === undefined ? {} : { periodStart: toDateOnly(body.periodStart) }),
      ...(body.periodEnd === undefined ? {} : { periodEnd: toDateOnly(body.periodEnd) }),
      ...(body.summary === undefined ? {} : { summary: body.summary }),
      ...(body.findings === undefined ? {} : { findings: body.findings }),
      ...(body.rootCauseNotes === undefined ? {} : { rootCauseNotes: body.rootCauseNotes }),
      ...(movingToFinal ? { closedAt: now } : {}),
      updatedAt: now,
    })
    .where(eq(complianceReportsTable.id, reportId));

  const updated = await db
    .select()
    .from(complianceReportsTable)
    .where(eq(complianceReportsTable.id, reportId))
    .limit(1);
  res.json(toReport(updated[0]));
});

export default router;
