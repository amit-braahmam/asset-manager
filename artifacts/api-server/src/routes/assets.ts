import { Router, type IRouter, type Request } from "express";
import { and, asc, desc, eq, ilike, or } from "drizzle-orm";
import {
  AssignAssetBody,
  AssignAssetParams,
  CreateAssetBody,
  GetAssetHistoryParams,
  GetAssetParams,
  GetDashboardActivityQueryParams,
  GetDashboardMaintenanceQueryParams,
  ListAssetsQueryParams,
  ListMaintenanceQueryParams,
  ReturnAssetParams,
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

const router: IRouter = Router();

type AssetRow = {
  asset: DbAsset;
  location: DbLocation;
  person: DbPerson | null;
};

const seedLocations = [
  { id: "loc-hq", name: "HQ · Bengaluru", city: "Bengaluru" },
  { id: "loc-nyc", name: "New York Office", city: "New York" },
  { id: "loc-lon", name: "London Office", city: "London" },
  { id: "loc-stock", name: "Central Stockroom", city: "Bengaluru" },
];

const seedPeople = [
  { id: "person-sarah", name: "Sarah Johnson", department: "Operations", email: "sarah.johnson@example.com" },
  { id: "person-daniel", name: "Daniel Smith", department: "Finance", email: "daniel.smith@example.com" },
  { id: "person-priya", name: "Priya Nair", department: "Engineering", email: "priya.nair@example.com" },
  { id: "person-marcus", name: "Marcus Lee", department: "Sales", email: "marcus.lee@example.com" },
];

type SeedAsset = [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string | null,
];

const seedAssets: SeedAsset[] = [
  ["LT-8842", "MacBook Pro 14", "Laptop", "Apple", "MacBook Pro M2", "C02M2A8842", "available", "excellent", "loc-hq", null],
  ["LT-9102", "ThinkPad T14", "Laptop", "Lenovo", "ThinkPad T14 Gen 4", "PF4T149102", "assigned", "good", "loc-hq", "person-daniel"],
  ["LT-9217", "MacBook Air 13", "Laptop", "Apple", "MacBook Air M2", "C02A9217", "assigned", "excellent", "loc-lon", "person-priya"],
  ["LT-8731", "Latitude 7440", "Laptop", "Dell", "Latitude 7440", "DL74408731", "in_repair", "fair", "loc-stock", null],
  ["LT-9450", "Surface Laptop 5", "Laptop", "Microsoft", "Surface Laptop 5", "MSL59450", "available", "good", "loc-stock", null],
  ["MON-1740", "UltraSharp 27", "Monitor", "Dell", "U2723QE", "CN0U27231740", "available", "excellent", "loc-stock", null],
  ["MON-1751", "UltraSharp 27", "Monitor", "Dell", "U2723QE", "CN0U27231751", "assigned", "good", "loc-hq", "person-sarah"],
  ["MON-1812", "Studio Display", "Monitor", "Apple", "Studio Display", "C02SD1812", "assigned", "excellent", "loc-lon", "person-priya"],
  ["MON-1899", "ThinkVision 24", "Monitor", "Lenovo", "ThinkVision T24i", "VNT241899", "available", "good", "loc-nyc", null],
  ["SRV-B-04", "Server Node", "Server", "Dell", "PowerEdge R740", "SVR740B04", "in_repair", "poor", "loc-hq", null],
  ["SRV-DB-01", "Database Server", "Server", "HPE", "ProLiant DL360", "HPE360DB01", "assigned", "good", "loc-hq", "person-sarah"],
  ["SRV-APP-02", "Application Server", "Server", "Dell", "PowerEdge R640", "SVR640APP02", "available", "good", "loc-stock", null],
  ["PRN-FL2-01", "Network Printer", "Peripheral", "Brother", "MFC-L8900", "BRL8900FL2", "available", "good", "loc-hq", null],
  ["PH-2201", "iPhone 14", "Mobile", "Apple", "iPhone 14", "F17PH2201", "assigned", "excellent", "loc-nyc", "person-marcus"],
  ["PH-2207", "Pixel 8", "Mobile", "Google", "Pixel 8", "PX8PH2207", "available", "excellent", "loc-stock", null],
  ["TAB-113", "iPad Air", "Mobile", "Apple", "iPad Air 5", "DMPAD113", "assigned", "good", "loc-lon", "person-priya"],
  ["DOCK-401", "USB-C Dock", "Peripheral", "CalDigit", "TS4", "CDTS4401", "available", "good", "loc-stock", null],
  ["SW-CORE-1", "Network Switch", "Networking", "Cisco", "Catalyst 9300", "FCW9300CORE1", "assigned", "good", "loc-hq", "person-sarah"],
  ["FW-EDGE-01", "Edge Firewall", "Networking", "Fortinet", "FortiGate 60F", "FG60FEDGE01", "assigned", "good", "loc-hq", "person-sarah"],
  ["CAM-088", "Conference Camera", "Peripheral", "Logitech", "Rally Bar Mini", "LGRALLY088", "available", "good", "loc-nyc", null],
];

const seedReady = seedDatabase();

async function seedDatabase() {
  const existing = await db.select({ id: assetsTable.id }).from(assetsTable).limit(1);
  if (existing.length > 0) return;

  await db.insert(locationsTable).values(seedLocations).onConflictDoNothing();
  await db.insert(peopleTable).values(seedPeople).onConflictDoNothing();

  const now = new Date();
  const seededAssets: Array<typeof assetsTable.$inferInsert> = seedAssets.map((asset, index) => ({
      id: `asset-${String(index + 1).padStart(3, "0")}`,
      assetTag: asset[0],
      name: asset[1],
      category: asset[2],
      manufacturer: asset[3],
      model: asset[4],
      serialNumber: asset[5],
      status: asset[6],
      condition: asset[7],
      locationId: asset[8],
      assigneeId: asset[9],
      warrantyEnd: "2026-12-31",
      purchaseDate: "2024-01-15",
      purchaseCost: index % 3 === 0 ? "1899.00" : "849.00",
      notes: "",
      specifications: (asset[2] === "Laptop"
        ? { CPU: "Apple M2 / Intel i7", RAM: "16 GB", Storage: "512 GB SSD" }
        : { Profile: "Standard managed equipment", Coverage: "Business support" }) as Record<string, string>,
      createdAt: now,
      updatedAt: now,
    }));
  await db.insert(assetsTable).values(seededAssets).onConflictDoNothing();

  await db.insert(maintenanceTable).values([
    { id: "maint-001", assetId: "asset-010", scheduledAt: new Date("2026-09-04T02:00:00Z"), technician: "J. Doe · Tier 3", priority: "high", status: "pending" },
    { id: "maint-002", assetId: "asset-013", scheduledAt: new Date("2026-09-06T14:00:00Z"), technician: "External Vendor", priority: "normal", status: "scheduled" },
    { id: "maint-003", assetId: "asset-004", scheduledAt: new Date("2026-09-08T09:00:00Z"), technician: "IT Support Desk", priority: "normal", status: "scheduled" },
    { id: "maint-004", assetId: "asset-018", scheduledAt: new Date("2026-09-10T11:30:00Z"), technician: "Network Team", priority: "low", status: "scheduled" },
  ]).onConflictDoNothing();

  await db.insert(assetHistoryTable).values([
    { id: "hist-001", assetId: "asset-001", action: "return", detail: "MacBook Pro M2 returned to inventory.", actor: "Sarah Johnson", createdAt: new Date("2026-08-29T05:48:00Z") },
    { id: "hist-002", assetId: "asset-010", action: "alert", detail: "Server Node reported cooling failure.", actor: "System Alert", createdAt: new Date("2026-08-29T05:15:00Z") },
    { id: "hist-003", assetId: "asset-006", action: "import", detail: "Batch import completed: 50 Dell UltraSharp monitors added.", actor: "Admin", createdAt: new Date("2026-08-29T03:00:00Z") },
    { id: "hist-004", assetId: "asset-002", action: "assignment", detail: "ThinkPad T14 assigned to Daniel Smith.", actor: "IT Support", createdAt: new Date("2026-08-29T01:30:00Z") },
    { id: "hist-005", assetId: "asset-018", action: "update", detail: "Firmware update deployed to Network Switch.", actor: "Automated", createdAt: new Date("2026-08-28T23:30:00Z") },
  ]).onConflictDoNothing();
}

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
  return rows.map(({ maintenance, asset }) => ({
    id: maintenance.id,
    assetTag: asset.assetTag,
    category: asset.name,
    scheduledAt: maintenance.scheduledAt,
    technician: maintenance.technician,
    priority: maintenance.priority as ApiMaintenanceItem["priority"],
    status: maintenance.status as ApiMaintenanceItem["status"],
  }));
}

router.get("/dashboard/summary", async (_req, res) => {
  await seedReady;
  const rows = await db.select({ status: assetsTable.status }).from(assetsTable);
  const total = rows.length;
  const assigned = rows.filter((row) => row.status === "assigned").length;
  const inRepair = rows.filter((row) => row.status === "in_repair" || row.status === "rma").length;
  const available = rows.filter((row) => row.status === "available").length;
  const data: ApiDashboardSummary = {
    total,
    assigned,
    inRepair,
    available,
    utilization: total === 0 ? 0 : Math.round((assigned / total) * 100),
    changes: { total: 2, assigned: 1, inRepair: -1 },
  };
  res.json(data);
});

router.get("/dashboard/activity", async (req, res) => {
  await seedReady;
  const limit = getLimit(req, GetDashboardActivityQueryParams);
  const rows = await db
    .select({ history: assetHistoryTable, asset: assetsTable })
    .from(assetHistoryTable)
    .innerJoin(assetsTable, eq(assetHistoryTable.assetId, assetsTable.id))
    .orderBy(desc(assetHistoryTable.createdAt))
    .limit(limit);
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

router.post("/assets", async (req, res) => {
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
      actor: "IT Administrator",
    }),
  );
  const detail = await getAssetDetail(id);
  res.status(201).json(detail);
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

router.patch("/assets/:assetId", async (req, res) => {
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
      actor: "IT Administrator",
    }),
  );
  res.json(await getAssetDetail(assetId));
});

router.post("/assets/:assetId/assign", async (req, res) => {
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
      actor: "IT Administrator",
    }),
  );
  res.json(await getAssetDetail(assetId));
});

router.post("/assets/:assetId/return", async (req, res) => {
  await seedReady;
  const { assetId } = ReturnAssetParams.parse(req.params);
  const current = await getAssetDetail(assetId);
  if (!current) {
    res.status(404).json({ error: "Asset not found" });
    return;
  }
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
      actor: "IT Administrator",
    }),
  );
  res.json(await getAssetDetail(assetId));
});

router.post("/assets/:assetId/status", async (req, res) => {
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
      actor: "IT Administrator",
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

router.get("/maintenance", async (req, res) => {
  await seedReady;
  res.json(await listMaintenanceItems(getLimit(req, ListMaintenanceQueryParams)));
});

export default router;