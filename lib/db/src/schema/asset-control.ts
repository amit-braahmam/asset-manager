import { createInsertSchema } from "drizzle-zod";
import {
  date,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/pg-core";

// Application roles, ordered from highest to lowest privilege.
// Auditor sits just below Admin: broad read + audit/compliance authority.
export const USER_ROLES = [
  "admin",
  "auditor",
  "manager",
  "technician",
  "viewer",
] as const;
export type UserRole = (typeof USER_ROLES)[number];
export const DEFAULT_USER_ROLE: UserRole = "viewer";

export const usersTable = pgTable("asset_users", {
  // Clerk user id (e.g. "user_...")
  id: varchar("id", { length: 64 }).primaryKey(),
  email: text("email").notNull().default("").unique(),
  name: text("name").notNull().default(""),
  role: varchar("role", { length: 16 }).notNull().default(DEFAULT_USER_ROLE),
  // Clerk user id of whoever onboarded this user (null for self-registered).
  invitedBy: varchar("invited_by", { length: 64 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

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
  // Outcome of the performed work — used by Auditors to review activity output.
  resolutionNotes: text("resolution_notes").notNull().default(""),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  completedBy: text("completed_by"),
});

// Compliance reports follow a 3-stage workflow:
//   in_preparation -> ready_for_review -> final (closed, immutable)
export const COMPLIANCE_REPORT_STATUSES = [
  "in_preparation",
  "ready_for_review",
  "final",
] as const;
export type ComplianceReportStatus =
  (typeof COMPLIANCE_REPORT_STATUSES)[number];

export const complianceReportsTable = pgTable("asset_compliance_reports", {
  id: varchar("id", { length: 32 }).primaryKey(),
  title: text("title").notNull(),
  status: varchar("status", { length: 24 })
    .notNull()
    .default("in_preparation"),
  periodStart: date("period_start"),
  periodEnd: date("period_end"),
  summary: text("summary").notNull().default(""),
  findings: text("findings").notNull().default(""),
  rootCauseNotes: text("root_cause_notes").notNull().default(""),
  // Point-in-time metrics captured when the report is assembled.
  metrics: jsonb("metrics")
    .$type<Record<string, number>>()
    .notNull()
    .default({}),
  createdBy: varchar("created_by", { length: 64 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
});

/** Outbound product email log — unique per event/entity/window/recipient so cron and retries do not double-send. */
export const emailSendsTable = pgTable(
  "asset_email_sends",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    event: varchar("event", { length: 48 }).notNull(),
    entityId: varchar("entity_id", { length: 64 }).notNull(),
    window: varchar("window", { length: 32 }).notNull().default("default"),
    recipient: text("recipient").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("asset_email_sends_dedupe").on(
      table.event,
      table.entityId,
      table.window,
      table.recipient,
    ),
  ],
);

export const insertUserSchema = createInsertSchema(usersTable);
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
export const insertComplianceReportSchema = createInsertSchema(
  complianceReportsTable,
).omit({ createdAt: true, updatedAt: true });

export type User = typeof usersTable.$inferSelect;
export type Location = typeof locationsTable.$inferSelect;
export type Person = typeof peopleTable.$inferSelect;
export type Asset = typeof assetsTable.$inferSelect;
export type AssetHistory = typeof assetHistoryTable.$inferSelect;
export type Maintenance = typeof maintenanceTable.$inferSelect;
export type ComplianceReport = typeof complianceReportsTable.$inferSelect;
export type EmailSend = typeof emailSendsTable.$inferSelect;