import { Router, type IRouter } from "express";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import {
  GetAuditLogsQueryParams,
  type ActivityEvent,
} from "@workspace/api-zod";
import { db, assetHistoryTable, assetsTable } from "@workspace/db";
import { seedReady } from "../lib/seed";
import { requireRoles } from "../lib/auth";

const router: IRouter = Router();

function activityType(action: string): ActivityEvent["type"] {
  if (action === "return") return "return";
  if (action === "assignment") return "assignment";
  if (action === "alert") return "alert";
  if (action === "import") return "import";
  if (action === "maintenance") return "maintenance";
  return "update";
}

router.get("/audit/logs", requireRoles("admin", "auditor"), async (req, res) => {
  await seedReady;
  const query = GetAuditLogsQueryParams.parse(req.query);
  const conditions = [];
  if (query.action) conditions.push(eq(assetHistoryTable.action, query.action));
  if (query.search) {
    const search = `%${query.search}%`;
    conditions.push(
      or(ilike(assetHistoryTable.detail, search), ilike(assetsTable.assetTag, search)),
    );
  }
  const rows = await db
    .select({ history: assetHistoryTable, asset: assetsTable })
    .from(assetHistoryTable)
    .innerJoin(assetsTable, eq(assetHistoryTable.assetId, assetsTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(assetHistoryTable.createdAt))
    .limit(query.limit);
  const data: ActivityEvent[] = rows.map(({ history, asset }) => ({
    id: history.id,
    type: activityType(history.action),
    message: history.detail,
    actor: history.actor,
    createdAt: history.createdAt,
    assetTag: asset.assetTag,
  }));
  res.json(data);
});

export default router;
