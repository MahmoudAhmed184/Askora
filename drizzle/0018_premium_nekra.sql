CREATE TYPE "public"."question_generation_language" AS ENUM('egyptian_arabic', 'modern_standard_arabic', 'english');--> statement-breakpoint
CREATE TYPE "public"."question_generation_model_preference" AS ENUM('auto', 'gemini-3.6-flash', 'gemini-3.1-flash-lite');--> statement-breakpoint
CREATE TYPE "public"."question_generation_style" AS ENUM('balanced', 'deep_reflective', 'professional', 'personal', 'light_fun', 'surprise_me');--> statement-breakpoint
ALTER TYPE "public"."question_source" ADD VALUE 'ai_generated';--> statement-breakpoint
CREATE TABLE "question_generation_batches" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_user_id" text NOT NULL,
	"profile_id" text NOT NULL,
	"language" "question_generation_language" NOT NULL,
	"style" "question_generation_style" NOT NULL,
	"requested_count" integer NOT NULL,
	"model_used" text NOT NULL,
	"prompt_token_count" integer,
	"candidate_token_count" integer,
	"total_token_count" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "question_generation_batches_requested_count_check" CHECK ("question_generation_batches"."requested_count" in (3, 5, 10)),
	CONSTRAINT "question_generation_batches_model_used_check" CHECK ("question_generation_batches"."model_used" in ('gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.1-flash-lite')),
	CONSTRAINT "question_generation_batches_token_counts_check" CHECK (
        ("question_generation_batches"."prompt_token_count" is null or "question_generation_batches"."prompt_token_count" >= 0)
        and ("question_generation_batches"."candidate_token_count" is null or "question_generation_batches"."candidate_token_count" >= 0)
        and ("question_generation_batches"."total_token_count" is null or "question_generation_batches"."total_token_count" >= 0))
);
--> statement-breakpoint
CREATE TABLE "question_generation_settings" (
	"owner_user_id" text PRIMARY KEY NOT NULL,
	"gemini_key_ciphertext" text,
	"gemini_key_nonce" text,
	"gemini_key_auth_tag" text,
	"gemini_key_version" integer,
	"model_preference" "question_generation_model_preference" DEFAULT 'auto' NOT NULL,
	"question_interests" text[] DEFAULT '{}'::text[] NOT NULL,
	"credential_validated_at" timestamp with time zone,
	"data_disclosure_version" integer,
	"data_disclosure_accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "question_generation_settings_credential_material_check" CHECK (
        (
          "question_generation_settings"."gemini_key_ciphertext" is null
          and "question_generation_settings"."gemini_key_nonce" is null
          and "question_generation_settings"."gemini_key_auth_tag" is null
          and "question_generation_settings"."gemini_key_version" is null
        ) or (
          "question_generation_settings"."gemini_key_ciphertext" is not null
          and "question_generation_settings"."gemini_key_nonce" is not null
          and "question_generation_settings"."gemini_key_auth_tag" is not null
          and "question_generation_settings"."gemini_key_version" is not null
        ))
);
--> statement-breakpoint
ALTER TABLE "questions" ALTER COLUMN "safety_fingerprint_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "questions" ALTER COLUMN "safety_metadata_retain_until" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "generation_batch_id" text;--> statement-breakpoint
ALTER TABLE "question_generation_batches" ADD CONSTRAINT "question_generation_batches_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_generation_batches" ADD CONSTRAINT "question_generation_batches_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_generation_settings" ADD CONSTRAINT "question_generation_settings_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "question_generation_batches_owner_created_idx" ON "question_generation_batches" USING btree ("owner_user_id","created_at");--> statement-breakpoint
CREATE INDEX "question_generation_batches_profile_created_idx" ON "question_generation_batches" USING btree ("profile_id","created_at");--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_generation_batch_id_question_generation_batches_id_fk" FOREIGN KEY ("generation_batch_id") REFERENCES "public"."question_generation_batches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "questions_recipient_normalized_text_hash_idx" ON "questions" USING btree ("recipient_profile_id","normalized_text_hash");--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_source_generation_batch_check" CHECK (
        ("questions"."source" = 'ai_generated' and "questions"."generation_batch_id" is not null)
        or ("questions"."source" = 'public_profile' and "questions"."generation_batch_id" is null));--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_source_safety_metadata_check" CHECK (
        (
          "questions"."source" = 'public_profile'
          and "questions"."safety_fingerprint_hash" is not null
          and "questions"."safety_metadata_retain_until" is not null
        ) or (
          "questions"."source" = 'ai_generated'
          and "questions"."safety_fingerprint_hash" is null
          and "questions"."safety_metadata_retain_until" is null
        ));
--> statement-breakpoint
ALTER TABLE public.question_generation_batches ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL PRIVILEGES ON TABLE public.question_generation_batches FROM anon, authenticated;--> statement-breakpoint
ALTER TABLE public.question_generation_settings ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL PRIVILEGES ON TABLE public.question_generation_settings FROM anon, authenticated;
