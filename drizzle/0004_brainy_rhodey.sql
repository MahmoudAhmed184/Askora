CREATE TYPE "public"."moderation_report_reason" AS ENUM('harassment', 'hate', 'threats', 'sexual_content', 'self_harm', 'private_information', 'impersonation', 'spam_scam', 'other');--> statement-breakpoint
CREATE TYPE "public"."moderation_report_status" AS ENUM('open', 'reviewed', 'actioned', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."moderation_report_target_type" AS ENUM('question', 'thread_item', 'profile');--> statement-breakpoint
CREATE TABLE "blocks" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_profile_id" text NOT NULL,
	"owner_user_id" text NOT NULL,
	"blocked_user_id" text,
	"blocked_profile_id" text,
	"safety_fingerprint_hash" text,
	"ip_hash" text,
	"source_question_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "muted_phrases" (
	"id" text PRIMARY KEY NOT NULL,
	"profile_id" text NOT NULL,
	"phrase" text NOT NULL,
	"normalized_phrase" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" text PRIMARY KEY NOT NULL,
	"reporter_user_id" text,
	"reporter_profile_id" text,
	"target_type" "moderation_report_target_type" NOT NULL,
	"target_id" text NOT NULL,
	"reason" "moderation_report_reason" NOT NULL,
	"details" text,
	"status" "moderation_report_status" DEFAULT 'open' NOT NULL,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_owner_profile_id_profiles_id_fk" FOREIGN KEY ("owner_profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocked_user_id_users_id_fk" FOREIGN KEY ("blocked_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocked_profile_id_profiles_id_fk" FOREIGN KEY ("blocked_profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_source_question_id_questions_id_fk" FOREIGN KEY ("source_question_id") REFERENCES "public"."questions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "muted_phrases" ADD CONSTRAINT "muted_phrases_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_user_id_users_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_profile_id_profiles_id_fk" FOREIGN KEY ("reporter_profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "blocks_owner_profile_id_idx" ON "blocks" USING btree ("owner_profile_id");--> statement-breakpoint
CREATE INDEX "blocks_blocked_user_id_idx" ON "blocks" USING btree ("blocked_user_id");--> statement-breakpoint
CREATE INDEX "blocks_blocked_profile_id_idx" ON "blocks" USING btree ("blocked_profile_id");--> statement-breakpoint
CREATE INDEX "blocks_safety_fingerprint_idx" ON "blocks" USING btree ("safety_fingerprint_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "blocks_owner_blocked_user_unique" ON "blocks" USING btree ("owner_profile_id","blocked_user_id") WHERE "blocks"."blocked_user_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "blocks_owner_blocked_profile_unique" ON "blocks" USING btree ("owner_profile_id","blocked_profile_id") WHERE "blocks"."blocked_profile_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "blocks_owner_fingerprint_unique" ON "blocks" USING btree ("owner_profile_id","safety_fingerprint_hash") WHERE "blocks"."safety_fingerprint_hash" is not null;--> statement-breakpoint
CREATE INDEX "muted_phrases_profile_id_idx" ON "muted_phrases" USING btree ("profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "muted_phrases_profile_normalized_unique" ON "muted_phrases" USING btree ("profile_id","normalized_phrase");--> statement-breakpoint
CREATE INDEX "reports_reporter_user_id_idx" ON "reports" USING btree ("reporter_user_id");--> statement-breakpoint
CREATE INDEX "reports_reporter_profile_id_idx" ON "reports" USING btree ("reporter_profile_id");--> statement-breakpoint
CREATE INDEX "reports_target_idx" ON "reports" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "reports_status_created_idx" ON "reports" USING btree ("status","created_at");