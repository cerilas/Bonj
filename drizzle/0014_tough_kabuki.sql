CREATE TABLE "staff_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"staff_id" integer NOT NULL,
	"token_hash" varchar(128) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"full_name" varchar(120) NOT NULL,
	"phone" varchar(32) NOT NULL,
	"role" varchar(24) DEFAULT 'garson' NOT NULL,
	"password_hash" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "table_activity_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"table_id" integer NOT NULL,
	"session_id" integer,
	"actor_type" varchar(16) NOT NULL,
	"actor_id" integer NOT NULL,
	"actor_name" varchar(120) NOT NULL,
	"actor_role" varchar(24) NOT NULL,
	"action" varchar(32) NOT NULL,
	"summary" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "staff_sessions" ADD CONSTRAINT "staff_sessions_staff_id_staff_users_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_activity_logs" ADD CONSTRAINT "table_activity_logs_table_id_cafe_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."cafe_tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_activity_logs" ADD CONSTRAINT "table_activity_logs_session_id_table_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."table_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "staff_sessions_token_uidx" ON "staff_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "staff_sessions_staff_idx" ON "staff_sessions" USING btree ("staff_id");--> statement-breakpoint
CREATE INDEX "staff_sessions_expires_idx" ON "staff_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_users_phone_uidx" ON "staff_users" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "staff_users_role_idx" ON "staff_users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "table_activity_logs_table_created_idx" ON "table_activity_logs" USING btree ("table_id","created_at");--> statement-breakpoint
CREATE INDEX "table_activity_logs_created_idx" ON "table_activity_logs" USING btree ("created_at");