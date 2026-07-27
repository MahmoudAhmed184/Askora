CREATE TYPE "public"."admin_action_type" AS ENUM('dismiss', 'warn', 'suspend_7_days', 'suspend_30_days', 'permanent_suspension', 'hide_profile', 'remove_public_content');--> statement-breakpoint
CREATE TABLE "admin_actions" (
	"id" text PRIMARY KEY NOT NULL,
	"report_id" text NOT NULL,
	"admin_user_id" text NOT NULL,
	"action_type" "admin_action_type" NOT NULL,
	"report_target_type" "moderation_report_target_type" NOT NULL,
	"report_target_id" text NOT NULL,
	"target_user_id" text,
	"target_profile_id" text,
	"target_question_id" text,
	"target_thread_item_id" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_actions" ADD CONSTRAINT "admin_actions_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_actions" ADD CONSTRAINT "admin_actions_admin_user_id_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_actions" ADD CONSTRAINT "admin_actions_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_actions" ADD CONSTRAINT "admin_actions_target_profile_id_profiles_id_fk" FOREIGN KEY ("target_profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_actions" ADD CONSTRAINT "admin_actions_target_question_id_questions_id_fk" FOREIGN KEY ("target_question_id") REFERENCES "public"."questions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_actions" ADD CONSTRAINT "admin_actions_target_thread_item_id_thread_items_id_fk" FOREIGN KEY ("target_thread_item_id") REFERENCES "public"."thread_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_actions_report_id_idx" ON "admin_actions" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "admin_actions_admin_user_id_idx" ON "admin_actions" USING btree ("admin_user_id");--> statement-breakpoint
CREATE INDEX "admin_actions_action_type_idx" ON "admin_actions" USING btree ("action_type");--> statement-breakpoint
CREATE INDEX "admin_actions_target_idx" ON "admin_actions" USING btree ("report_target_type","report_target_id");--> statement-breakpoint
CREATE INDEX "admin_actions_target_user_id_idx" ON "admin_actions" USING btree ("target_user_id");--> statement-breakpoint
CREATE INDEX "admin_actions_target_profile_id_idx" ON "admin_actions" USING btree ("target_profile_id");
CREATE UNIQUE INDEX "notifications_profile_followed_unique" ON "notifications" USING btree ("recipient_user_id","type","actor_user_id") WHERE "notifications"."type" = 'profile_followed' and "notifications"."actor_user_id" is not null;--> statement-breakpoint
