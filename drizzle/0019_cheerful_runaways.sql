ALTER TABLE "question_generation_batches" DROP CONSTRAINT "question_generation_batches_model_used_check";--> statement-breakpoint
ALTER TABLE "question_generation_settings" ALTER COLUMN "model_preference" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "question_generation_settings" ALTER COLUMN "model_preference" SET DEFAULT 'auto'::text;--> statement-breakpoint
UPDATE "question_generation_settings" SET "model_preference" = 'gemini-3.5-flash-lite' WHERE "model_preference" = 'gemini-3.1-flash-lite';--> statement-breakpoint
DROP TYPE "public"."question_generation_model_preference";--> statement-breakpoint
CREATE TYPE "public"."question_generation_model_preference" AS ENUM('auto', 'gemini-3.6-flash', 'gemini-3.5-flash-lite');--> statement-breakpoint
ALTER TABLE "question_generation_settings" ALTER COLUMN "model_preference" SET DEFAULT 'auto'::"public"."question_generation_model_preference";--> statement-breakpoint
ALTER TABLE "question_generation_settings" ALTER COLUMN "model_preference" SET DATA TYPE "public"."question_generation_model_preference" USING "model_preference"::"public"."question_generation_model_preference";--> statement-breakpoint
ALTER TABLE "question_generation_batches" ADD CONSTRAINT "question_generation_batches_model_used_check" CHECK ("question_generation_batches"."model_used" in ('gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'));
