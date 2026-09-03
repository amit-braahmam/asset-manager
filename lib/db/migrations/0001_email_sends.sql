CREATE TABLE "asset_email_sends" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"event" varchar(48) NOT NULL,
	"entity_id" varchar(64) NOT NULL,
	"window" varchar(32) DEFAULT 'default' NOT NULL,
	"recipient" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "asset_email_sends_dedupe" UNIQUE("event","entity_id","window","recipient")
);
