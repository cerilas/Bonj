CREATE TABLE "notification_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"notification_type" varchar(40) NOT NULL,
	"phone_number" varchar(20),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "notification_settings_type_uidx" ON "notification_settings" USING btree ("notification_type");