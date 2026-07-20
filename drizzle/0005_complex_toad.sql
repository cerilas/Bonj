CREATE TABLE "catering_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_number" varchar(40) NOT NULL,
	"event_type" varchar(48) NOT NULL,
	"full_name" varchar(120) NOT NULL,
	"phone" varchar(32) NOT NULL,
	"email" varchar(180),
	"company" varchar(120),
	"event_at" timestamp with time zone NOT NULL,
	"guest_count" integer NOT NULL,
	"venue_name" varchar(180),
	"venue_address" text NOT NULL,
	"venue_setting" varchar(24) NOT NULL,
	"service_style" varchar(32) NOT NULL,
	"menu_interests" text NOT NULL,
	"dietary_needs" text,
	"budget_range" varchar(32),
	"preferred_contact" varchar(24) NOT NULL,
	"notes" text,
	"status" varchar(24) DEFAULT 'new' NOT NULL,
	"consent" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "catering_requests_number_uidx" ON "catering_requests" USING btree ("request_number");--> statement-breakpoint
CREATE INDEX "catering_requests_status_created_idx" ON "catering_requests" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "catering_requests_event_at_idx" ON "catering_requests" USING btree ("event_at");--> statement-breakpoint
CREATE INDEX "catering_requests_phone_created_idx" ON "catering_requests" USING btree ("phone","created_at");