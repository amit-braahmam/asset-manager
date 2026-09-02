import {
  db,
  assetHistoryTable,
  assetsTable,
  locationsTable,
  maintenanceTable,
  peopleTable,
} from "@workspace/db";

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

function shouldSeedDemo(): boolean {
  if (process.env.SEED_DEMO === "true") return true;
  if (process.env.SEED_DEMO === "false") return false;
  return process.env.NODE_ENV !== "production";
}

/**
 * Idempotent demo seed. Awaited by data routes so a fresh local database is
 * populated on first request. Disabled in production unless SEED_DEMO=true.
 */
export const seedReady: Promise<void> = shouldSeedDemo()
  ? seedDatabase()
  : Promise.resolve();
