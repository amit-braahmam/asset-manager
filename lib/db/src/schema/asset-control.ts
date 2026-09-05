import { createInsertSchema } from "drizzle-zod";
import {
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/pg-core";
import type { LookupGroup } from "../lookups";

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

export const departmentsTable = pgTable("asset_departments", {
  id: varchar("id", { length: 32 }).primaryKey(),
  name: text("name").notNull().unique(),
});

export const lookupOptionsTable = pgTable(
  "asset_lookup_options",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    group: varchar("group", { length: 32 }).$type<LookupGroup>().notNull(),
    value: varchar("value", { length: 64 }).notNull(),
    label: text("label").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
    system: boolean("system").notNull().default(false),
  },
  (table) => [
    unique("asset_lookup_options_group_value").on(table.group, table.value),
  ],
);

export const peopleTable = pgTable("asset_people", {
  id: varchar("id", { length: 32 }).primaryKey(),
  name: text("name").notNull(),
  departmentId: varchar("department_id", { length: 32 })
    .notNull()
    .references(() => departmentsTable.id),
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
  status: varchar("status", { length: 64 }).notNull().default("available"),
  condition: varchar("condition", { length: 24 }).notNull().default("good"),
  locationId: varchar("location_id", { length: 32 })
    .notNull()
    .references(() => locationsTable.id),
  assigneeId: varchar("assignee_id", { length: 32 }).references(
    () => peopleTable.id,
  ),
  assignedAt: timestamp("assigned_at", { withTimezone: true }),
  warrantyEnd: date("warranty_end"),
  purchaseDate: date("purchase_date"),
  purchaseCost: numeric("purchase_cost", { precision: 12, scale: 2 }),
  description: text("description").notNull().default(""),
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

export const MAINTENANCE_SCOPES = ["asset", "estate"] as const;
export type MaintenanceScope = (typeof MAINTENANCE_SCOPES)[number];

export const MAINTENANCE_MODES = ["scheduled", "emergency"] as const;
export type MaintenanceMode = (typeof MAINTENANCE_MODES)[number];

export const MAINTENANCE_ACTIVITY_TYPES = [
  "os_patch",
  "application_patch",
  "lan",
  "firewall",
  "other",
] as const;
export type MaintenanceActivityType = (typeof MAINTENANCE_ACTIVITY_TYPES)[number];

export const maintenanceTable = pgTable("asset_maintenance", {
  id: varchar("id", { length: 32 }).primaryKey(),
  assetId: varchar("asset_id", { length: 32 }).references(() => assetsTable.id),
  title: text("title").notNull().default(""),
  scope: varchar("scope", { length: 16 }).notNull().default("asset"),
  mode: varchar("mode", { length: 64 }).notNull().default("scheduled"),
  activityType: varchar("activity_type", { length: 64 }).notNull().default("other"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  technician: text("technician").notNull(),
  priority: varchar("priority", { length: 64 }).notNull().default("normal"),
  status: varchar("status", { length: 64 }).notNull().default("scheduled"),
  // Outcome of the performed work — used by Auditors to review activity output.
  resolutionNotes: text("resolution_notes").notNull().default(""),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  completedBy: text("completed_by"),
});

export const ATTACHMENT_ENTITY_TYPES = ["asset", "maintenance"] as const;
export type AttachmentEntityType = (typeof ATTACHMENT_ENTITY_TYPES)[number];

export const attachmentsTable = pgTable("asset_attachments", {
  id: varchar("id", { length: 32 }).primaryKey(),
  entityType: varchar("entity_type", { length: 16 }).notNull(),
  entityId: varchar("entity_id", { length: 32 }).notNull(),
  fileName: text("file_name").notNull(),
  contentType: text("content_type").notNull(),
  url: text("url").notNull(),
  storageKey: text("storage_key").notNull(),
  uploadedBy: text("uploaded_by").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
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
export const insertDepartmentSchema = createInsertSchema(departmentsTable);
export const insertLookupOptionSchema = createInsertSchema(lookupOptionsTable);
export const insertPersonSchema = createInsertSchema(peopleTable);
export const insertAssetSchema = createInsertSchema(assetsTable).omit({
  createdAt: true,
  updatedAt: true,
});
export const insertAssetHistorySchema = createInsertSchema(
  assetHistoryTable,
).omit({ createdAt: true });
export const insertMaintenanceSchema = createInsertSchema(maintenanceTable);
export const insertAttachmentSchema = createInsertSchema(attachmentsTable).omit({
  createdAt: true,
});
export const insertComplianceReportSchema = createInsertSchema(
  complianceReportsTable,
).omit({ createdAt: true, updatedAt: true });

export type User = typeof usersTable.$inferSelect;
export type Location = typeof locationsTable.$inferSelect;
export type Department = typeof departmentsTable.$inferSelect;
export type LookupOption = typeof lookupOptionsTable.$inferSelect;
export type Person = typeof peopleTable.$inferSelect;
export type Asset = typeof assetsTable.$inferSelect;
export type AssetHistory = typeof assetHistoryTable.$inferSelect;
export type Maintenance = typeof maintenanceTable.$inferSelect;
export type Attachment = typeof attachmentsTable.$inferSelect;
export type ComplianceReport = typeof complianceReportsTable.$inferSelect;
export type EmailSend = typeof emailSendsTable.$inferSelect;

export const CUSTODY_CHECK_STATUSES = ["open", "closed"] as const;
export type CustodyCheckStatus = (typeof CUSTODY_CHECK_STATUSES)[number];

export const CUSTODY_CADENCES = ["hour", "day"] as const;
export type CustodyCadence = (typeof CUSTODY_CADENCES)[number];

export const CUSTODY_MAIL_STATUSES = ["queued", "sent", "blocked", "skipped_no_email"] as const;
export type CustodyMailStatus = (typeof CUSTODY_MAIL_STATUSES)[number];

export const CUSTODY_ITEM_RESPONSES = ["pending", "confirmed", "denied"] as const;
export type CustodyItemResponse = (typeof CUSTODY_ITEM_RESPONSES)[number];

export const custodyChecksTable = pgTable("asset_custody_checks", {
  id: varchar("id", { length: 32 }).primaryKey(),
  title: text("title").notNull(),
  dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
  status: varchar("status", { length: 16 }).$type<CustodyCheckStatus>().notNull().default("open"),
  batchSize: integer("batch_size").notNull().default(25),
  cadence: varchar("cadence", { length: 8 }).$type<CustodyCadence>().notNull().default("hour"),
  lastSendAt: timestamp("last_send_at", { withTimezone: true }),
  locationId: varchar("location_id", { length: 32 }),
  departmentId: varchar("department_id", { length: 32 }),
  createdBy: varchar("created_by", { length: 64 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const custodyRecipientsTable = pgTable("asset_custody_recipients", {
  id: varchar("id", { length: 32 }).primaryKey(),
  checkId: varchar("check_id", { length: 32 })
    .notNull()
    .references(() => custodyChecksTable.id),
  personId: varchar("person_id", { length: 32 }).notNull(),
  personName: text("person_name").notNull(),
  email: text("email").notNull().default(""),
  tokenHash: varchar("token_hash", { length: 64 }),
  mailStatus: varchar("mail_status", { length: 24 }).$type<CustodyMailStatus>().notNull().default("queued"),
  sendAttempts: integer("send_attempts").notNull().default(0),
  lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const custodyItemsTable = pgTable("asset_custody_items", {
  id: varchar("id", { length: 32 }).primaryKey(),
  checkId: varchar("check_id", { length: 32 })
    .notNull()
    .references(() => custodyChecksTable.id),
  recipientId: varchar("recipient_id", { length: 32 })
    .notNull()
    .references(() => custodyRecipientsTable.id),
  assetId: varchar("asset_id", { length: 32 }).notNull(),
  assetTag: varchar("asset_tag", { length: 64 }).notNull(),
  assetName: text("asset_name").notNull(),
  response: varchar("response", { length: 16 }).$type<CustodyItemResponse>().notNull().default("pending"),
  respondedAt: timestamp("responded_at", { withTimezone: true }),
  note: text("note").notNull().default(""),
});

export const insertCustodyCheckSchema = createInsertSchema(custodyChecksTable).omit({
  createdAt: true,
});
export const insertCustodyRecipientSchema = createInsertSchema(custodyRecipientsTable).omit({
  createdAt: true,
});
export const insertCustodyItemSchema = createInsertSchema(custodyItemsTable);

export type CustodyCheck = typeof custodyChecksTable.$inferSelect;
export type CustodyRecipient = typeof custodyRecipientsTable.$inferSelect;
export type CustodyItem = typeof custodyItemsTable.$inferSelect;