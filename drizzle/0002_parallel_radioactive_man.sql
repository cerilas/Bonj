CREATE TABLE "category_images" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" integer NOT NULL,
	"data" "bytea" NOT NULL,
	"mime_type" varchar(48) NOT NULL,
	"size_in_bytes" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "image_alt" varchar(180);--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "category_images" ADD CONSTRAINT "category_images_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "category_images_category_uidx" ON "category_images" USING btree ("category_id");