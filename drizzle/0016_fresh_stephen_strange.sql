DELETE FROM "questions" WHERE "source" = 'starter_prompt';--> statement-breakpoint
ALTER TABLE "questions" ALTER COLUMN "source" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "questions" ALTER COLUMN "source" SET DEFAULT 'public_profile'::text;--> statement-breakpoint
DROP TYPE "public"."question_source";--> statement-breakpoint
CREATE TYPE "public"."question_source" AS ENUM('public_profile');--> statement-breakpoint
ALTER TABLE "questions" ALTER COLUMN "source" SET DEFAULT 'public_profile'::"public"."question_source";--> statement-breakpoint
ALTER TABLE "questions" ALTER COLUMN "source" SET DATA TYPE "public"."question_source" USING "source"::"public"."question_source";
