import { Router, type IRouter, type Request } from "express";
import { and, asc, desc, eq, gte, ilike, or } from "drizzle-orm";
import {
  AssignAssetBody,
  AssignAssetParams,
  BulkUpdateAssetStatusBody,
  CreateAssetBody,
  CreateLocationBody,
  CreateMaintenanceBody,
  CreatePersonBody,
  DeleteMaintenanceParams,
  GetAssetHistoryParams,
  GetAssetParams,
  GetDashboardActivityQueryParams,
  GetDashboardMaintenanceQueryParams,
  ListAssetsQueryParams,
  ListMaintenanceQueryParams,
  ReturnAssetParams,
  UpdateLocationBody,
  UpdateLocationParams,
  UpdateMaintenanceBody,
  UpdateMaintenanceParams,
  UpdatePersonBody,
  UpdatePersonParams,
  UpdateAssetBody,
  UpdateAssetParams,
  UpdateAssetStatusBody,
  UpdateAssetStatusParams,
  type ActivityEvent,
  type Asset as ApiAsset,
  type AssetDetail as ApiAssetDetail,
  type DashboardSummary as ApiDashboardSummary,
  type HistoryEvent as ApiHistoryEvent,
  type Location as ApiLocation,
  type MaintenanceItem as ApiMaintenanceItem,
  type Person as ApiPerson,
} from "@workspace/api-zod";
import {
  assetHistoryTable,
  assetsTable,
  insertAssetHistorySchema,
  locationsTable,
  maintenanceTable,
  peopleTable,
  type Asset as DbAsset,
  type Location as DbLocation,
  type Person as DbPerson,
} from "@workspace/db";
import { db } from "@workspace/db";
import { randomUUID } from "node:crypto";
import { seedReady } from "../lib/seed";
import { actorLabel, requireRoles } from "../lib/auth";
import { assigneeEmailFor, notify } from "../lib/notify";

const router: IRouter = Router();

type AssetRow = {
  asset: DbAsset;
  location: DbLocation;
  person: DbPerson | null;
};

function toLocation(row: DbLocation, assetCount = 0): ApiLocation {
  return { ...row, assetCount };
}

function toPerson(row: DbPerson | null): ApiPerson | null {
  return row;
}

function toDateValue(value: string | null): Date | null {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

function toDateOnly(value: Date | null | undefined): string | null | undefined {
  return value ? value.toISOString().slice(0, 10) : value;
}

function toAsset(row: AssetRow, locationAssetCount = 0): ApiAsset {
  return {
    id: row.asset.id,
    assetTag: row.asset.assetTag,
    name: row.asset.name,
    category: row.asset.category,
    manufacturer: row.asset.manufacturer,
    model: row.asset.model,
    serialNumber: row.asset.serialNumber,
    status: row.asset.status as ApiAsset["status"],
    condition: row.asset.condition as ApiAsset["condition"],
    location: toLocation(row.location, locationAssetCount),
    assignee: toPerson(row.person),
    warrantyEnd: toDateValue(row.asset.warrantyEnd),
    purchaseDate: toDateValue(row.asset.purchaseDate),
    purchaseCost: row.asset.purchaseCost === null ? null : Number(row.asset.purchaseCost),
    lastUpdated: row.asset.updatedAt,
  };
}

async function getAssetRows(): Promise<AssetRow[]> {
  const rows = await db
    .select({ asset: assetsTable, location: locationsTable, person: peopleTable })
    .from(assetsTable)
    .innerJoin(locationsTable, eq(assetsTable.locationId, locationsTable.id))
    .leftJoin(peopleTable, eq(assetsTable.assigneeId, peopleTable.id));
  return rows as AssetRow[];
}

async function getHistory(assetId: string): Promise<ApiHistoryEvent[]> {
  const rows = await db
    .select()
    .from(assetHistoryTable)
    .where(eq(assetHistoryTable.assetId, assetId))
    .orderBy(desc(assetHistoryTable.createdAt));
  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    detail: row.detail,
    actor: row.actor,
    createdAt: row.createdAt,
  }));
}

async function getAssetDetail(assetId: string): Promise<ApiAssetDetail | null> {
  const rows = await getAssetRows();
  const row = rows.find((item) => item.asset.id === assetId);
  if (!row) return null;
  const locationAssetCount = rows.filter((item) => item.asset.locationId === row.asset.locationId).length;
  return {
    ...toAsset(row, locationAssetCount),
    notes: row.asset.notes,
    specifications: row.asset.specifications,
    history: await getHistory(assetId),
  };
}

function getLimit(req: Request, parser: typeof GetDashboardActivityQueryParams | typeof GetDashboardMaintenanceQueryParams | typeof ListMaintenanceQueryParams) {
  const result = parser.safeParse(req.query);
  return result.success ? result.data.limit : 5;
}

function activityType(action: string): ActivityEvent["type"] {
  if (action === "return") return "return";
  if (action === "assignment") return "assignment";
  if (action === "alert") return "alert";
  if (action === "import") return "import";
  if (action === "maintenance") return "maintenance";
  return "update";
}

async function listMaintenanceItems(limit: number): Promise<ApiMaintenanceItem[]> {
  const rows = await db
    .select({ maintenance: maintenanceTable, asset: assetsTable })
    .from(maintenanceTable)
    .innerJoin(assetsTable, eq(maintenanceTable.assetId, assetsTable.id))
    .orderBy(asc(maintenanceTable.scheduledAt))
    .limit(limit);
  return rows.map(({ maintenance, asset }) => toMaintenanceItem(maintenance, asset));
}

function toMaintenanceItem(
  maintenance: typeof maintenanceTable.$inferSelect,
  asset: Pick<DbAsset, "assetTag" | "name">,
): ApiMaintenanceItem {
  return {
    id: maintenance.id,
    assetTag: asset.assetTag,
    category: asset.name,
    scheduledAt: maintenance.scheduledAt,
    technician: maintenance.technician,
    priority: maintenance.priority as ApiMaintenanceItem["priority"],
    status: maintenance.status as ApiMaintenanceItem["status"],
    resolutionNotes: maintenance.resolutionNotes,
    completedAt: maintenance.completedAt,
    completedBy: maintenance.completedBy,
  };
}

router.get("/dashboard/summary", async (_req, res) => {
  await seedReady;
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [rows, recentHistory] = await Promise.all([
    db.select({ status: assetsTable.status, createdAt: assetsTable.createdAt }).from(assetsTable),
    db
      .select({ action: assetHistoryTable.action })
      .from(assetHistoryTable)
      .where(gte(assetHistoryTable.createdAt, weekAgo)),
  ]);
  const total = rows.length;
  const assigned = rows.filter((row) => row.status === "assigned").length;
  const inRepair = rows.filter((row) => row.status === "in_repair" || row.status === "rma").length;
  const available = rows.filter((row) => row.status === "available").length;
  const assignments = recentHistory.filter((row) => row.action === "assignment").length;
  const returns = recentHistory.filter((row) => row.action === "return").length;
  const data: ApiDashboardSummary = {
    total,
    assigned,
    inRepair,
    available,
    utilization: total === 0 ? 0 : Math.round((assigned / total) * 100),
    changes: {
      total: rows.filter((row) => row.createdAt >= weekAgo).length,
      assigned: assignments - returns,
      inRepair: recentHistory.filter((row) => row.action === "maintenance").length,
    },
  };
  res.json(data);
});

router.get("/dashboard/activity", async (req, res) => {
  await seedReady;
  const query = GetDashboardActivityQueryParams.parse(req.query);
  const conditions = [];
  if (query.action) conditions.push(eq(assetHistoryTable.action, query.action));
  if (query.search) {
    const search = `%${query.search}%`;
    conditions.push(or(ilike(assetHistoryTable.detail, search), ilike(assetsTable.assetTag, search)));
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

router.get("/dashboard/maintenance", async (req, res) => {
  await seedReady;
  res.json(await listMaintenanceItems(getLimit(req, GetDashboardMaintenanceQueryParams)));
});

router.get("/assets", async (req, res) => {
  await seedReady;
  const query = ListAssetsQueryParams.parse(req.query);
  const conditions = [];
  if (query.status) conditions.push(eq(assetsTable.status, query.status));
  if (query.category) conditions.push(eq(assetsTable.category, query.category));
  if (query.locationId) conditions.push(eq(assetsTable.locationId, query.locationId));
  if (query.search) {
    const search = `%${query.search}%`;
    conditions.push(or(
      ilike(assetsTable.assetTag, search),
      ilike(assetsTable.name, search),
      ilike(assetsTable.model, search),
      ilike(assetsTable.serialNumber, search),
    ));
  }

  const rows = await db
    .select({ asset: assetsTable, location: locationsTable, person: peopleTable })
    .from(assetsTable)
    .innerJoin(locationsTable, eq(assetsTable.locationId, locationsTable.id))
    .leftJoin(peopleTable, eq(assetsTable.assigneeId, peopleTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(assetsTable.updatedAt));

  const start = (query.page - 1) * query.pageSize;
  const locationCounts = new Map<string, number>();
  rows.forEach((row) => {
    locationCounts.set(row.asset.locationId, (locationCounts.get(row.asset.locationId) ?? 0) + 1);
  });
  res.json({
    items: rows
      .slice(start, start + query.pageSize)
      .map((row) => toAsset(row as AssetRow, locationCounts.get(row.asset.locationId) ?? 0)),
    total: rows.length,
    page: query.page,
    pageSize: query.pageSize,
  });
});

router.post("/assets", requireRoles("admin", "manager"), async (req, res) => {
  await seedReady;
  const body = CreateAssetBody.parse(req.body);
  const id = `asset-${randomUUID().slice(0, 8)}`;
  const now = new Date();
  await db.insert(assetsTable).values({
    id,
    assetTag: body.assetTag,
    name: body.name,
    category: body.category,
    manufacturer: body.manufacturer,
    model: body.model,
    serialNumber: body.serialNumber,
    status: body.status,
    condition: body.condition,
    locationId: body.locationId,
    warrantyEnd: toDateOnly(body.warrantyEnd) ?? null,
    purchaseDate: toDateOnly(body.purchaseDate) ?? null,
    purchaseCost: body.purchaseCost === null || body.purchaseCost === undefined ? null : String(body.purchaseCost),
    notes: body.notes,
    specifications: {},
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(assetHistoryTable).values(
    insertAssetHistorySchema.parse({
      id: `hist-${randomUUID().slice(0, 8)}`,
      assetId: id,
      action: "update",
      detail: `Asset ${body.assetTag} added to inventory.`,
      actor: actorLabel(req),
    }),
  );
  const detail = await getAssetDetail(id);
  res.status(201).json(detail);
});

router.post("/assets/bulk/status", requireRoles("admin", "manager"), async (req, res) => {
  await seedReady;
  const body = BulkUpdateAssetStatusBody.parse(req.body);
  const assetIds = Array.from(new Set(body.assetIds));
  const rows = await getAssetRows();
  const existing = new Map(rows.map((row) => [row.asset.id, row]));
  const missing = assetIds.filter((assetId) => !existing.has(assetId));
  if (missing.length > 0) {
    res.status(404).json({ error: `Assets not found: ${missing.join(", ")}` });
    return;
  }

  const now = new Date();
  for (const assetId of assetIds) {
    await db.update(assetsTable).set({
      status: body.status,
      ...(body.status === "available" ? { assigneeId: null } : {}),
      updatedAt: now,
    }).where(eq(assetsTable.id, assetId));
    await db.insert(assetHistoryTable).values(insertAssetHistorySchema.parse({
      id: `hist-${randomUUID().slice(0, 8)}`,
      assetId,
      action: "update",
      detail: `Bulk status update: ${body.status.replaceAll("_", " ")}.${body.note ? ` ${body.note}` : ""}`,
      actor: actorLabel(req),
    }));
  }

  const updatedRows = await getAssetRows();
  const locationCounts = new Map<string, number>();
  updatedRows.forEach((row) => {
    locationCounts.set(row.asset.locationId, (locationCounts.get(row.asset.locationId) ?? 0) + 1);
  });
  res.json(assetIds.map((assetId) => {
    const row = updatedRows.find((item) => item.asset.id === assetId);
    return row ? toAsset(row, locationCounts.get(row.asset.locationId) ?? 0) : null;
  }).filter((asset): asset is ApiAsset => asset !== null));
});

router.get("/assets/:assetId", async (req, res) => {
  await seedReady;
  const { assetId } = GetAssetParams.parse(req.params);
  const detail = await getAssetDetail(assetId);
  if (!detail) {
    res.status(404).json({ error: "Asset not found" });
    return;
  }
  res.json(detail);
});

router.patch("/assets/:assetId", requireRoles("admin", "manager"), async (req, res) => {
  await seedReady;
  const { assetId } = UpdateAssetParams.parse(req.params);
  const body = UpdateAssetBody.parse(req.body);
  const current = await getAssetDetail(assetId);
  if (!current) {
    res.status(404).json({ error: "Asset not found" });
    return;
  }
  const updates = {
    ...(body.name === undefined ? {} : { name: body.name }),
    ...(body.category === undefined ? {} : { category: body.category }),
    ...(body.manufacturer === undefined ? {} : { manufacturer: body.manufacturer }),
    ...(body.model === undefined ? {} : { model: body.model }),
    ...(body.serialNumber === undefined ? {} : { serialNumber: body.serialNumber }),
    ...(body.condition === undefined ? {} : { condition: body.condition }),
    ...(body.locationId === undefined ? {} : { locationId: body.locationId }),
    ...(body.warrantyEnd === undefined ? {} : { warrantyEnd: toDateOnly(body.warrantyEnd) }),
    ...(body.purchaseDate === undefined ? {} : { purchaseDate: toDateOnly(body.purchaseDate) }),
    ...(body.purchaseCost === undefined ? {} : { purchaseCost: body.purchaseCost === null ? null : String(body.purchaseCost) }),
    ...(body.notes === undefined ? {} : { notes: body.notes }),
    updatedAt: new Date(),
  };
  await db.update(assetsTable).set(updates).where(eq(assetsTable.id, assetId));
  await db.insert(assetHistoryTable).values(
    insertAssetHistorySchema.parse({
      id: `hist-${randomUUID().slice(0, 8)}`,
      assetId,
      action: "update",
      detail: "Asset details updated.",
      actor: actorLabel(req),
    }),
  );
  res.json(await getAssetDetail(assetId));
});

router.post("/assets/:assetId/assign", requireRoles("admin", "manager"), async (req, res) => {
  await seedReady;
  const { assetId } = AssignAssetParams.parse(req.params);
  const body = AssignAssetBody.parse(req.body);
  const person = await db.select().from(peopleTable).where(eq(peopleTable.id, body.personId)).limit(1);
  if (person.length === 0) {
    res.status(404).json({ error: "Person not found" });
    return;
  }
  const current = await getAssetDetail(assetId);
  if (!current) {
    res.status(404).json({ error: "Asset not found" });
    return;
  }
  await db.update(assetsTable).set({
    assigneeId: body.personId,
    locationId: body.locationId,
    status: "assigned",
    updatedAt: new Date(),
  }).where(eq(assetsTable.id, assetId));
  await db.insert(assetHistoryTable).values(
    insertAssetHistorySchema.parse({
      id: `hist-${randomUUID().slice(0, 8)}`,
      assetId,
      action: "assignment",
      detail: `${current.name} assigned to ${person[0].name}.`,
      actor: actorLabel(req),
    }),
  );
  await notify({
    type: "asset_assigned",
    assetId,
    assetTag: current.assetTag,
    assetName: current.name,
    personName: person[0].name,
    personEmail: person[0].email,
  });
  res.json(await getAssetDetail(assetId));
});

router.post("/assets/:assetId/return", requireRoles("admin", "manager"), async (req, res) => {
  await seedReady;
  const { assetId } = ReturnAssetParams.parse(req.params);
  const current = await getAssetDetail(assetId);
  if (!current) {
    res.status(404).json({ error: "Asset not found" });
    return;
  }
  const previous = current.assignee;
  await db.update(assetsTable).set({
    assigneeId: null,
    status: "available",
    updatedAt: new Date(),
  }).where(eq(assetsTable.id, assetId));
  await db.insert(assetHistoryTable).values(
    insertAssetHistorySchema.parse({
      id: `hist-${randomUUID().slice(0, 8)}`,
      assetId,
      action: "return",
      detail: `${current.name} returned to available stock.`,
      actor: actorLabel(req),
    }),
  );
  if (previous?.email) {
    await notify({
      type: "asset_returned",
      assetId,
      assetTag: current.assetTag,
      assetName: current.name,
      personName: previous.name,
      personEmail: previous.email,
    });
  }
  res.json(await getAssetDetail(assetId));
});

router.post("/assets/:assetId/status", requireRoles("admin", "manager", "technician"), async (req, res) => {
  await seedReady;
  const { assetId } = UpdateAssetStatusParams.parse(req.params);
  const body = UpdateAssetStatusBody.parse(req.body);
  const current = await getAssetDetail(assetId);
  if (!current) {
    res.status(404).json({ error: "Asset not found" });
    return;
  }
  await db.update(assetsTable).set({
    status: body.status,
    ...(body.status === "available" ? { assigneeId: null } : {}),
    updatedAt: new Date(),
  }).where(eq(assetsTable.id, assetId));
  await db.insert(assetHistoryTable).values(
    insertAssetHistorySchema.parse({
      id: `hist-${randomUUID().slice(0, 8)}`,
      assetId,
      action: body.status === "in_repair" || body.status === "rma" ? "maintenance" : "update",
      detail: `${current.name} status changed to ${body.status.replaceAll("_", " ")}.${body.note ? ` ${body.note}` : ""}`,
      actor: actorLabel(req),
    }),
  );
  res.json(await getAssetDetail(assetId));
});

router.get("/assets/:assetId/history", async (req, res) => {
  await seedReady;
  const { assetId } = GetAssetHistoryParams.parse(req.params);
  const current = await getAssetDetail(assetId);
  if (!current) {
    res.status(404).json({ error: "Asset not found" });
    return;
  }
  res.json(await getHistory(assetId));
});

router.get("/locations", async (_req, res) => {
  await seedReady;
  const [locations, assets] = await Promise.all([
    db.select().from(locationsTable).orderBy(asc(locationsTable.name)),
    db.select({ locationId: assetsTable.locationId }).from(assetsTable),
  ]);
  const counts = new Map<string, number>();
  assets.forEach(({ locationId }) => counts.set(locationId, (counts.get(locationId) ?? 0) + 1));
  res.json(locations.map((location) => ({
    id: location.id,
    name: location.name,
    city: location.city,
    assetCount: counts.get(location.id) ?? 0,
  })));
});

router.post("/locations", requireRoles("admin", "manager"), async (req, res) => {
  await seedReady;
  const body = CreateLocationBody.parse(req.body);
  const location = {
    id: `loc-${randomUUID().slice(0, 8)}`,
    name: body.name,
    city: body.city,
  };
  await db.insert(locationsTable).values(location);
  res.status(201).json({ ...location, assetCount: 0 });
});

router.patch("/locations/:locationId", requireRoles("admin", "manager"), async (req, res) => {
  await seedReady;
  const { locationId } = UpdateLocationParams.parse(req.params);
  const body = UpdateLocationBody.parse(req.body);
  const existing = await db.select().from(locationsTable).where(eq(locationsTable.id, locationId)).limit(1);
  if (existing.length === 0) {
    res.status(404).json({ error: "Location not found" });
    return;
  }
  await db.update(locationsTable).set({
    ...(body.name === undefined ? {} : { name: body.name }),
    ...(body.city === undefined ? {} : { city: body.city }),
  }).where(eq(locationsTable.id, locationId));
  const assetCount = await db.select({ locationId: assetsTable.locationId }).from(assetsTable).where(eq(assetsTable.locationId, locationId));
  const updated = await db.select().from(locationsTable).where(eq(locationsTable.id, locationId)).limit(1);
  res.json({ ...updated[0], assetCount: assetCount.length });
});

router.get("/people", async (_req, res) => {
  await seedReady;
  res.json(await db.select().from(peopleTable).orderBy(asc(peopleTable.name)));
});

router.post("/people", requireRoles("admin", "manager"), async (req, res) => {
  await seedReady;
  const body = CreatePersonBody.parse(req.body);
  const person = {
    id: `person-${randomUUID().slice(0, 8)}`,
    name: body.name,
    department: body.department,
    email: body.email,
  };
  await db.insert(peopleTable).values(person);
  res.status(201).json(person);
});

router.patch("/people/:personId", requireRoles("admin", "manager"), async (req, res) => {
  await seedReady;
  const { personId } = UpdatePersonParams.parse(req.params);
  const body = UpdatePersonBody.parse(req.body);
  const existing = await db.select().from(peopleTable).where(eq(peopleTable.id, personId)).limit(1);
  if (existing.length === 0) {
    res.status(404).json({ error: "Person not found" });
    return;
  }
  await db.update(peopleTable).set({
    ...(body.name === undefined ? {} : { name: body.name }),
    ...(body.department === undefined ? {} : { department: body.department }),
    ...(body.email === undefined ? {} : { email: body.email }),
  }).where(eq(peopleTable.id, personId));
  const updated = await db.select().from(peopleTable).where(eq(peopleTable.id, personId)).limit(1);
  res.json(updated[0]);
});

router.get("/maintenance", async (req, res) => {
  await seedReady;
  res.json(await listMaintenanceItems(getLimit(req, ListMaintenanceQueryParams)));
});

router.post("/maintenance", requireRoles("admin", "manager"), async (req, res) => {
  await seedReady;
  const body = CreateMaintenanceBody.parse(req.body);
  const asset = await db.select().from(assetsTable).where(eq(assetsTable.id, body.assetId)).limit(1);
  if (asset.length === 0) {
    res.status(404).json({ error: "Asset not found" });
    return;
  }
  const maintenance = {
    id: `maint-${randomUUID().slice(0, 8)}`,
    assetId: body.assetId,
    scheduledAt: body.scheduledAt,
    technician: body.technician,
    priority: body.priority,
    status: body.status,
    resolutionNotes: body.resolutionNotes ?? "",
    completedAt: null,
    completedBy: null,
  };
  await db.insert(maintenanceTable).values(maintenance);
  await db.insert(assetHistoryTable).values(insertAssetHistorySchema.parse({
    id: `hist-${randomUUID().slice(0, 8)}`,
    assetId: body.assetId,
    action: "maintenance",
    detail: `Maintenance scheduled with ${body.technician}.`,
    actor: actorLabel(req),
  }));
  await notify({
    type: "maintenance_scheduled",
    maintenanceId: maintenance.id,
    assetId: body.assetId,
    assetTag: asset[0].assetTag,
    assetName: asset[0].name,
    technician: body.technician,
    assigneeEmail: await assigneeEmailFor(asset[0].assigneeId),
  });
  res.status(201).json(toMaintenanceItem(maintenance, asset[0]));
});

router.patch("/maintenance/:maintenanceId", requireRoles("admin", "manager", "technician"), async (req, res) => {
  await seedReady;
  const { maintenanceId } = UpdateMaintenanceParams.parse(req.params);
  const body = UpdateMaintenanceBody.parse(req.body);
  const current = await db.select({ maintenance: maintenanceTable, asset: assetsTable })
    .from(maintenanceTable)
    .innerJoin(assetsTable, eq(maintenanceTable.assetId, assetsTable.id))
    .where(eq(maintenanceTable.id, maintenanceId))
    .limit(1);
  if (current.length === 0) {
    res.status(404).json({ error: "Maintenance item not found" });
    return;
  }
  const wasCompleted = current[0].maintenance.status === "completed";
  const nextStatus = body.status ?? current[0].maintenance.status;
  const completion =
    body.status === undefined || nextStatus === current[0].maintenance.status
      ? {}
      : nextStatus === "completed"
        ? { completedAt: new Date(), completedBy: actorLabel(req) }
        : wasCompleted
          ? { completedAt: null, completedBy: null }
          : {};
  await db.update(maintenanceTable).set({
    ...(body.scheduledAt === undefined ? {} : { scheduledAt: body.scheduledAt }),
    ...(body.technician === undefined ? {} : { technician: body.technician }),
    ...(body.priority === undefined ? {} : { priority: body.priority }),
    ...(body.status === undefined ? {} : { status: body.status }),
    ...(body.resolutionNotes === undefined ? {} : { resolutionNotes: body.resolutionNotes }),
    ...completion,
  }).where(eq(maintenanceTable.id, maintenanceId));

  if (nextStatus === "completed" && !wasCompleted) {
    await db.insert(assetHistoryTable).values(insertAssetHistorySchema.parse({
      id: `hist-${randomUUID().slice(0, 8)}`,
      assetId: current[0].maintenance.assetId,
      action: "maintenance",
      detail: `Maintenance completed on ${current[0].asset.assetTag}.${body.resolutionNotes ? ` ${body.resolutionNotes}` : ""}`,
      actor: actorLabel(req),
    }));
    await notify({
      type: "maintenance_completed",
      maintenanceId,
      assetId: current[0].maintenance.assetId,
      assetTag: current[0].asset.assetTag,
      assetName: current[0].asset.name,
      technician: body.technician ?? current[0].maintenance.technician,
      assigneeEmail: await assigneeEmailFor(current[0].asset.assigneeId),
      notes: body.resolutionNotes ?? current[0].maintenance.resolutionNotes,
    });
  }

  const updated = await db.select({ maintenance: maintenanceTable, asset: assetsTable })
    .from(maintenanceTable)
    .innerJoin(assetsTable, eq(maintenanceTable.assetId, assetsTable.id))
    .where(eq(maintenanceTable.id, maintenanceId))
    .limit(1);
  res.json(toMaintenanceItem(updated[0].maintenance, updated[0].asset));
});

router.delete("/maintenance/:maintenanceId", requireRoles("admin", "manager"), async (req, res) => {
  await seedReady;
  const { maintenanceId } = DeleteMaintenanceParams.parse(req.params);
  const existing = await db.select().from(maintenanceTable).where(eq(maintenanceTable.id, maintenanceId)).limit(1);
  if (existing.length === 0) {
    res.status(404).json({ error: "Maintenance item not found" });
    return;
  }
  await db.delete(maintenanceTable).where(eq(maintenanceTable.id, maintenanceId));
  res.status(204).send();
});

export default router;
