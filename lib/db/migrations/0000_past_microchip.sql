CREATE TABLE "asset_history" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"asset_id" varchar(32) NOT NULL,
	"action" text NOT NULL,
	"detail" text NOT NULL,
	"actor" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"asset_tag" varchar(64) NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"manufacturer" text NOT NULL,
	"model" text NOT NULL,
	"serial_number" varchar(128) NOT NULL,
	"status" varchar(24) DEFAULT 'available' NOT NULL,
	"condition" varchar(24) DEFAULT 'good' NOT NULL,
	"location_id" varchar(32) NOT NULL,
	"assignee_id" varchar(32),
	"warranty_end" date,
	"purchase_date" date,
	"purchase_cost" numeric(12, 2),
	"notes" text DEFAULT '' NOT NULL,
	"specifications" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assets_asset_tag_unique" UNIQUE("asset_tag"),
	CONSTRAINT "assets_serial_number_unique" UNIQUE("serial_number")
);
--> statement-breakpoint
CREATE TABLE "asset_compliance_reports" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"status" varchar(24) DEFAULT 'in_preparation' NOT NULL,
	"period_start" date,
	"period_end" date,
	"summary" text DEFAULT '' NOT NULL,
	"findings" text DEFAULT '' NOT NULL,
	"root_cause_notes" text DEFAULT '' NOT NULL,
	"metrics" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "asset_locations" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"city" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "asset_maintenance" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"asset_id" varchar(32) NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"technician" text NOT NULL,
	"priority" varchar(16) DEFAULT 'normal' NOT NULL,
	"status" varchar(16) DEFAULT 'scheduled' NOT NULL,
	"resolution_notes" text DEFAULT '' NOT NULL,
	"completed_at" timestamp with time zone,
	"completed_by" text
);
--> statement-breakpoint
CREATE TABLE "asset_people" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"department" text NOT NULL,
	"email" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "asset_users" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"role" varchar(16) DEFAULT 'viewer' NOT NULL,
	"invited_by" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "asset_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "asset_history" ADD CONSTRAINT "asset_history_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_location_id_asset_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."asset_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_assignee_id_asset_people_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."asset_people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_maintenance" ADD CONSTRAINT "asset_maintenance_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;