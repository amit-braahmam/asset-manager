import { createInsertSchema } from "drizzle-zod";
import {
  date,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const locationsTable = pgTable("asset_locations", {
  id: varchar("id", { length: 32 }).primaryKey(),
  name: text("name").notNull(),
  city: text("city").notNull(),
});

export const peopleTable = pgTable("asset_people", {
  id: varchar("id", { length: 32 }).primaryKey(),
  name: text("name").notNull(),
  department: text("department").notNull(),
  email: text("email").notNull(),
});

export const assetsTable = pgTable("assets", {
  id: varchar("id", { length: 32 }).primaryKey(),
  assetTag: varchar("asset_tag", { length: 64 }).notNull().unique(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  manufacturer: text("manufacturer").notNull(),
  model: text("model").notNull(),
  serialNumber: varchar("serial_number", { length: 128 }).notNull().unique(),
  status: varchar("status", { length: 24 }).notNull().default("available"),
  condition: varchar("condition", { length: 24 }).notNull().default("good"),
  locationId: varchar("location_id", { length: 32 })
    .notNull()
    .references(() => locationsTable.id),
  assigneeId: varchar("assignee_id", { length: 32 }).references(
    () => peopleTable.id,
  ),
  warrantyEnd: date("warranty_end"),
  purchaseDate: date("purchase_date"),
  purchaseCost: numeric("purchase_cost", { precision: 12, scale: 2 }),
  notes: text("notes").notNull().default(""),
  specifications: jsonb("specifications")
    .$type<Record<string, string>>()
    .notNull()
    .default({}),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const assetHistoryTable = pgTable("asset_history", {
  id: varchar("id", { length: 32 }).primaryKey(),
  assetId: varchar("asset_id", { length: 32 })
    .notNull()
    .references(() => assetsTable.id),
  action: text("action").notNull(),
  detail: text("detail").notNull(),
  actor: text("actor").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const maintenanceTable = pgTable("asset_maintenance", {
  id: varchar("id", { length: 32 }).primaryKey(),
  assetId: varchar("asset_id", { length: 32 })
    .notNull()
    .references(() => assetsTable.id),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  technician: text("technician").notNull(),
  priority: varchar("priority", { length: 16 }).notNull().default("normal"),
  status: varchar("status", { length: 16 }).notNull().default("scheduled"),
});

export const insertLocationSchema = createInsertSchema(locationsTable);
export const insertPersonSchema = createInsertSchema(peopleTable);
export const insertAssetSchema = createInsertSchema(assetsTable).omit({
  createdAt: true,
  updatedAt: true,
});
export const insertAssetHistorySchema = createInsertSchema(
  assetHistoryTable,
).omit({ createdAt: true });
export const insertMaintenanceSchema = createInsertSchema(maintenanceTable);

export type Location = typeof locationsTable.$inferSelect;
export type Person = typeof peopleTable.$inferSelect;
export type Asset = typeof assetsTable.$inferSelect;
export type AssetHistory = typeof assetHistoryTable.$inferSelect;
export type Maintenance = typeof maintenanceTable.$inferSelect;