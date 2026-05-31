CREATE TYPE "public"."profile_deactivation_reason" AS ENUM('user', 'account_deletion', 'admin');--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "deletion_grace_ends_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "deletion_anonymized_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "deactivated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "deactivation_reason" "profile_deactivation_reason";--> statement-breakpoint
CREATE INDEX "users_deletion_cleanup_idx" ON "users" USING btree ("deleted_at","deletion_grace_ends_at","deletion_anonymized_at");--> statement-breakpoint
CREATE INDEX "profiles_deactivation_reason_idx" ON "profiles" USING btree ("deactivation_reason");