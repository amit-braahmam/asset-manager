CREATE TABLE "asset_custody_checks" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"status" varchar(16) DEFAULT 'open' NOT NULL,
	"batch_size" integer DEFAULT 25 NOT NULL,
	"cadence" varchar(8) DEFAULT 'hour' NOT NULL,
	"last_send_at" timestamp with time zone,
	"location_id" varchar(32),
	"department_id" varchar(32),
	"created_by" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "asset_custody_recipients" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"check_id" varchar(32) NOT NULL,
	"person_id" varchar(32) NOT NULL,
	"person_name" text NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"token_hash" varchar(64),
	"mail_status" varchar(24) DEFAULT 'queued' NOT NULL,
	"send_attempts" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "asset_custody_recipients_check_id_asset_custody_checks_id_fk" FOREIGN KEY ("check_id") REFERENCES "asset_custody_checks"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX "asset_custody_recipients_token_hash" ON "asset_custody_recipients" ("token_hash") WHERE "token_hash" IS NOT NULL;
--> statement-breakpoint
CREATE TABLE "asset_custody_items" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"check_id" varchar(32) NOT NULL,
	"recipient_id" varchar(32) NOT NULL,
	"asset_id" varchar(32) NOT NULL,
	"asset_tag" varchar(64) NOT NULL,
	"asset_name" text NOT NULL,
	"response" varchar(16) DEFAULT 'pending' NOT NULL,
	"responded_at" timestamp with time zone,
	"note" text DEFAULT '' NOT NULL,
	CONSTRAINT "asset_custody_items_check_id_asset_custody_checks_id_fk" FOREIGN KEY ("check_id") REFERENCES "asset_custody_checks"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "asset_custody_items_recipient_id_asset_custody_recipients_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "asset_custody_recipients"("id") ON DELETE cascade ON UPDATE no action
);
