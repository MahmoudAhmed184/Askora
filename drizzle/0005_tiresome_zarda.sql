CREATE TYPE "public"."notification_type" AS ENUM('question_answered');--> statement-breakpoint
CREATE TYPE "public"."question_text_mode" AS ENUM('original', 'edited', 'hidden');--> statement-breakpoint
CREATE TYPE "public"."thread_item_status" AS ENUM('draft', 'published', 'unpublished', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."thread_status" AS ENUM('draft', 'published', 'unpublished', 'deleted');--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"recipient_user_id" text NOT NULL,
	"type" "notification_type" NOT NULL,
	"actor_user_id" text,
	"thread_id" text,
	"thread_item_id" text,
	"question_id" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "thread_items" (
	"id" text PRIMARY KEY NOT NULL,
	"public_id" text NOT NULL,
	"thread_id" text NOT NULL,
	"question_id" text NOT NULL,
	"answer_text" text NOT NULL,
	"display_question_text" text,
	"question_text_mode" "question_text_mode" DEFAULT 'original' NOT NULL,
	"status" "thread_item_status" DEFAULT 'draft' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "threads" (
	"id" text PRIMARY KEY NOT NULL,
	"public_id" text NOT NULL,
	"owner_profile_id" text NOT NULL,
	"initial_question_id" text NOT NULL,
	"status" "thread_status" DEFAULT 'draft' NOT NULL,
	"follow_up_permission_override" "follow_up_permission",
	"follow_ups_enabled" boolean DEFAULT true NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "thread_id" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_thread_item_id_thread_items_id_fk" FOREIGN KEY ("thread_item_id") REFERENCES "public"."thread_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thread_items" ADD CONSTRAINT "thread_items_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thread_items" ADD CONSTRAINT "thread_items_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threads" ADD CONSTRAINT "threads_owner_profile_id_profiles_id_fk" FOREIGN KEY ("owner_profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threads" ADD CONSTRAINT "threads_initial_question_id_questions_id_fk" FOREIGN KEY ("initial_question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notifications_recipient_created_idx" ON "notifications" USING btree ("recipient_user_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_recipient_read_idx" ON "notifications" USING btree ("recipient_user_id","read_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_question_answered_unique" ON "notifications" USING btree ("recipient_user_id","type","question_id") WHERE "notifications"."type" = 'question_answered' and "notifications"."question_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "thread_items_public_id_unique" ON "thread_items" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "thread_items_question_id_unique" ON "thread_items" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "thread_items_thread_status_position_idx" ON "thread_items" USING btree ("thread_id","status","position");--> statement-breakpoint
CREATE INDEX "thread_items_published_idx" ON "thread_items" USING btree ("status","published_at") WHERE "thread_items"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "threads_public_id_unique" ON "threads" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "threads_initial_question_id_unique" ON "threads" USING btree ("initial_question_id");--> statement-breakpoint
CREATE INDEX "threads_owner_status_published_idx" ON "threads" USING btree ("owner_profile_id","status","published_at");--> statement-breakpoint
CREATE INDEX "threads_owner_draft_updated_idx" ON "threads" USING btree ("owner_profile_id","updated_at") WHERE "threads"."status" = 'draft';--> statement-breakpoint
CREATE INDEX "questions_thread_id_idx" ON "questions" USING btree ("thread_id");