ALTER TABLE "questions" DROP CONSTRAINT "questions_source_generation_batch_check";--> statement-breakpoint
ALTER TABLE "questions" DROP CONSTRAINT "questions_source_safety_metadata_check";--> statement-breakpoint
ALTER TABLE "questions" DROP CONSTRAINT "questions_generation_batch_id_question_generation_batches_id_fk";
--> statement-breakpoint
ALTER TABLE "questions" DROP COLUMN "source";--> statement-breakpoint
ALTER TABLE "questions" DROP COLUMN "generation_batch_id";--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_safety_metadata_pair_check" CHECK (
        (
          "questions"."safety_fingerprint_hash" is not null
          and "questions"."safety_metadata_retain_until" is not null
        ) or (
          "questions"."safety_fingerprint_hash" is null
          and "questions"."safety_metadata_retain_until" is null
        ));--> statement-breakpoint
DROP TYPE "public"."question_source";