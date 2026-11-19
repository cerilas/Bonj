CREATE TABLE "cafe_tables" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(20) NOT NULL,
	"name" varchar(60) NOT NULL,
	"zone" varchar(40) DEFAULT 'Salon' NOT NULL,
	"capacity" integer DEFAULT 4 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "table_session_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"menu_item_id" integer,
	"product_name" varchar(120) NOT NULL,
	"unit_price_in_kurus" integer NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"note" varchar(180),
	"source" varchar(20) DEFAULT 'pos' NOT NULL,
	"order_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "table_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"table_id" integer NOT NULL,
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"guest_count" integer DEFAULT 2 NOT NULL,
	"customer_name" varchar(120),
	"note" text,
	"payment_method" varchar(24),
	"paid_cash_in_kurus" integer DEFAULT 0 NOT NULL,
	"paid_card_in_kurus" integer DEFAULT 0 NOT NULL,
	"discount_in_kurus" integer DEFAULT 0 NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "table_session_items" ADD CONSTRAINT "table_session_items_session_id_table_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."table_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_session_items" ADD CONSTRAINT "table_session_items_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_session_items" ADD CONSTRAINT "table_session_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_sessions" ADD CONSTRAINT "table_sessions_table_id_cafe_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."cafe_tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cafe_tables_code_uidx" ON "cafe_tables" USING btree ("code");--> statement-breakpoint
CREATE INDEX "cafe_tables_sort_idx" ON "cafe_tables" USING btree ("sort_order","id");--> statement-breakpoint
CREATE INDEX "table_session_items_session_idx" ON "table_session_items" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "table_session_items_menu_item_idx" ON "table_session_items" USING btree ("menu_item_id");--> statement-breakpoint
CREATE INDEX "table_sessions_table_status_idx" ON "table_sessions" USING btree ("table_id","status");--> statement-breakpoint
CREATE INDEX "table_sessions_opened_idx" ON "table_sessions" USING btree ("opened_at");