CREATE TYPE "public"."thread_item_deleted_by" AS ENUM('owner', 'admin');--> statement-breakpoint
CREATE TABLE "pinned_answers" (
	"profile_id" text NOT NULL,
	"thread_item_id" text NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "thread_items" ADD COLUMN "deleted_by" "thread_item_deleted_by";--> statement-breakpoint
ALTER TABLE "pinned_answers" ADD CONSTRAINT "pinned_answers_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pinned_answers" ADD CONSTRAINT "pinned_answers_thread_item_id_thread_items_id_fk" FOREIGN KEY ("thread_item_id") REFERENCES "public"."thread_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pinned_answers_profile_position_unique" ON "pinned_answers" USING btree ("profile_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "pinned_answers_profile_thread_item_unique" ON "pinned_answers" USING btree ("profile_id","thread_item_id");