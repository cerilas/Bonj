CREATE TABLE "contact_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"topic" varchar(32) NOT NULL,
	"full_name" varchar(120) NOT NULL,
	"email" varchar(180) NOT NULL,
	"phone" varchar(32),
	"company" varchar(120),
	"message" text NOT NULL,
	"status" varchar(24) DEFAULT 'new' NOT NULL,
	"consent" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "contact_messages_status_created_idx" ON "contact_messages" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "contact_messages_email_created_idx" ON "contact_messages" USING btree ("email","created_at");