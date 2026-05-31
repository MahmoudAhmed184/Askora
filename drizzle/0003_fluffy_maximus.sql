CREATE TYPE "public"."question_deleted_by" AS ENUM('asker', 'recipient', 'moderator');--> statement-breakpoint
CREATE TYPE "public"."question_identity_mode" AS ENUM('guest_anonymous', 'account_anonymous', 'account_attributed');--> statement-breakpoint
CREATE TYPE "public"."question_source" AS ENUM('public_profile');--> statement-breakpoint
CREATE TYPE "public"."question_status" AS ENUM('inbox', 'filtered', 'draft', 'answered');--> statement-breakpoint
CREATE TABLE "questions" (
	"id" text PRIMARY KEY NOT NULL,
	"public_id" text NOT NULL,
	"recipient_profile_id" text NOT NULL,
	"recipient_user_id" text NOT NULL,
	"asker_user_id" text,
	"asker_profile_id" text,
	"identity_mode" "question_identity_mode" NOT NULL,
	"source" "question_source" DEFAULT 'public_profile' NOT NULL,
	"status" "question_status" DEFAULT 'inbox' NOT NULL,
	"original_text" text NOT NULL,
	"normalized_text_hash" text NOT NULL,
	"ip_hash" text,
	"user_agent_hash" text,
	"safety_fingerprint_hash" text NOT NULL,
	"safety_metadata_retain_until" timestamp with time zone NOT NULL,
	"anonymized_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"deleted_by" "question_deleted_by",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_recipient_profile_id_profiles_id_fk" FOREIGN KEY ("recipient_profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_asker_user_id_users_id_fk" FOREIGN KEY ("asker_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_asker_profile_id_profiles_id_fk" FOREIGN KEY ("asker_profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "questions_public_id_unique" ON "questions" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "questions_recipient_inbox_idx" ON "questions" USING btree ("recipient_profile_id","created_at") WHERE "questions"."status" = 'inbox' and "questions"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "questions_asker_regret_idx" ON "questions" USING btree ("asker_user_id","status","deleted_at","created_at");--> statement-breakpoint
CREATE INDEX "questions_recipient_status_created_idx" ON "questions" USING btree ("recipient_profile_id","status","created_at");--> statement-breakpoint
CREATE INDEX "questions_safety_fingerprint_idx" ON "questions" USING btree ("safety_fingerprint_hash");--> statement-breakpoint
CREATE INDEX "questions_normalized_text_hash_idx" ON "questions" USING btree ("normalized_text_hash");
