CREATE TABLE "asset_departments" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "asset_departments_name_unique" UNIQUE("name")
);
--> statement-breakpoint
INSERT INTO "asset_departments" ("id", "name")
SELECT
	'dpt-' || substr(md5(lower(trim("department"))), 1, 12),
	trim("department")
FROM "asset_people"
WHERE trim("department") <> ''
GROUP BY trim("department");
--> statement-breakpoint
ALTER TABLE "asset_people" ADD COLUMN "department_id" varchar(32);
--> statement-breakpoint
UPDATE "asset_people"
SET "department_id" = 'dpt-' || substr(md5(lower(trim("department"))), 1, 12)
WHERE trim("department") <> '';
--> statement-breakpoint
INSERT INTO "asset_departments" ("id", "name")
SELECT 'dpt-unassigned', 'Unassigned'
WHERE EXISTS (
	SELECT 1 FROM "asset_people" WHERE "department_id" IS NULL
);
--> statement-breakpoint
UPDATE "asset_people" SET "department_id" = 'dpt-unassigned' WHERE "department_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "asset_people" ALTER COLUMN "department_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "asset_people" ADD CONSTRAINT "asset_people_department_id_asset_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."asset_departments"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "asset_people" DROP COLUMN "department";
--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "assigned_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "description" text DEFAULT '' NOT NULL;
--> statement-breakpoint
UPDATE "assets" SET "assigned_at" = "updated_at" WHERE "assignee_id" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "asset_maintenance" ALTER COLUMN "asset_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "asset_maintenance" ADD COLUMN "title" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "asset_maintenance" ADD COLUMN "scope" varchar(16) DEFAULT 'asset' NOT NULL;
--> statement-breakpoint
ALTER TABLE "asset_maintenance" ADD COLUMN "mode" varchar(16) DEFAULT 'scheduled' NOT NULL;
--> statement-breakpoint
ALTER TABLE "asset_maintenance" ADD COLUMN "activity_type" varchar(32) DEFAULT 'other' NOT NULL;
--> statement-breakpoint
UPDATE "asset_maintenance" SET "title" = 'Maintenance' WHERE "title" = '';
--> statement-breakpoint
CREATE TABLE "asset_attachments" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"entity_type" varchar(16) NOT NULL,
	"entity_id" varchar(32) NOT NULL,
	"file_name" text NOT NULL,
	"content_type" text NOT NULL,
	"url" text NOT NULL,
	"storage_key" text NOT NULL,
	"uploaded_by" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
