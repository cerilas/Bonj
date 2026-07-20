CREATE TABLE "analytics_page_views" (
	"id" serial PRIMARY KEY NOT NULL,
	"view_key" varchar(64) NOT NULL,
	"session_key" varchar(64) NOT NULL,
	"visitor_key" varchar(64) NOT NULL,
	"path" varchar(500) NOT NULL,
	"title" varchar(300),
	"duration_seconds" integer DEFAULT 0 NOT NULL,
	"viewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"left_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "analytics_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_key" varchar(64) NOT NULL,
	"visitor_key" varchar(64) NOT NULL,
	"entry_path" varchar(500) NOT NULL,
	"exit_path" varchar(500) NOT NULL,
	"referrer_host" varchar(180),
	"country" varchar(8),
	"region" varchar(120),
	"city" varchar(120),
	"device_type" varchar(24) DEFAULT 'unknown' NOT NULL,
	"browser" varchar(40),
	"page_view_count" integer DEFAULT 1 NOT NULL,
	"duration_seconds" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "analytics_visitors" (
	"visitor_key" varchar(64) PRIMARY KEY NOT NULL,
	"country" varchar(8),
	"region" varchar(120),
	"city" varchar(120),
	"device_type" varchar(24) DEFAULT 'unknown' NOT NULL,
	"browser" varchar(40),
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "analytics_sessions_key_uidx" ON "analytics_sessions" USING btree ("session_key");--> statement-breakpoint
ALTER TABLE "analytics_page_views" ADD CONSTRAINT "analytics_page_views_session_key_analytics_sessions_session_key_fk" FOREIGN KEY ("session_key") REFERENCES "public"."analytics_sessions"("session_key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_page_views" ADD CONSTRAINT "analytics_page_views_visitor_key_analytics_visitors_visitor_key_fk" FOREIGN KEY ("visitor_key") REFERENCES "public"."analytics_visitors"("visitor_key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_sessions" ADD CONSTRAINT "analytics_sessions_visitor_key_analytics_visitors_visitor_key_fk" FOREIGN KEY ("visitor_key") REFERENCES "public"."analytics_visitors"("visitor_key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "analytics_page_views_key_uidx" ON "analytics_page_views" USING btree ("view_key");--> statement-breakpoint
CREATE INDEX "analytics_page_views_viewed_idx" ON "analytics_page_views" USING btree ("viewed_at");--> statement-breakpoint
CREATE INDEX "analytics_page_views_path_idx" ON "analytics_page_views" USING btree ("path");--> statement-breakpoint
CREATE INDEX "analytics_page_views_session_idx" ON "analytics_page_views" USING btree ("session_key");--> statement-breakpoint
CREATE INDEX "analytics_page_views_visitor_idx" ON "analytics_page_views" USING btree ("visitor_key");--> statement-breakpoint
CREATE INDEX "analytics_sessions_started_idx" ON "analytics_sessions" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "analytics_sessions_visitor_idx" ON "analytics_sessions" USING btree ("visitor_key");--> statement-breakpoint
CREATE INDEX "analytics_sessions_location_idx" ON "analytics_sessions" USING btree ("country","region","city");--> statement-breakpoint
CREATE INDEX "analytics_visitors_last_seen_idx" ON "analytics_visitors" USING btree ("last_seen_at");
