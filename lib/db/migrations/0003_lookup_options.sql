CREATE TABLE "asset_lookup_options" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"group" varchar(32) NOT NULL,
	"value" varchar(64) NOT NULL,
	"label" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"system" boolean DEFAULT false NOT NULL,
	CONSTRAINT "asset_lookup_options_group_value" UNIQUE("group","value")
);
--> statement-breakpoint
ALTER TABLE "assets" ALTER COLUMN "status" SET DATA TYPE varchar(64);
--> statement-breakpoint
ALTER TABLE "asset_maintenance" ALTER COLUMN "mode" SET DATA TYPE varchar(64);
--> statement-breakpoint
ALTER TABLE "asset_maintenance" ALTER COLUMN "activity_type" SET DATA TYPE varchar(64);
--> statement-breakpoint
ALTER TABLE "asset_maintenance" ALTER COLUMN "priority" SET DATA TYPE varchar(64);
--> statement-breakpoint
ALTER TABLE "asset_maintenance" ALTER COLUMN "status" SET DATA TYPE varchar(64);
