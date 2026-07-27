ALTER TYPE "public"."notification_type" ADD VALUE 'answer_liked';--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_follow_up_asked_unique" ON "notifications" USING btree ("recipient_user_id","type","question_id") WHERE "notifications"."type" = 'follow_up_asked' and "notifications"."question_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_follow_up_answered_unique" ON "notifications" USING btree ("recipient_user_id","type","thread_item_id") WHERE "notifications"."type" = 'follow_up_answered' and "notifications"."thread_item_id" is not null;--> statement-breakpoint
CREATE TABLE "answer_like_notifications" (
	"actor_user_id" text NOT NULL,
	"thread_item_id" text NOT NULL,
	"owner_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "follows" (
	"follower_profile_id" text NOT NULL,
	"followed_profile_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "likes" (
	"profile_id" text NOT NULL,
	"thread_item_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "answer_like_notifications" ADD CONSTRAINT "answer_like_notifications_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "answer_like_notifications" ADD CONSTRAINT "answer_like_notifications_thread_item_id_thread_items_id_fk" FOREIGN KEY ("thread_item_id") REFERENCES "public"."thread_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "answer_like_notifications" ADD CONSTRAINT "answer_like_notifications_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_follower_profile_id_profiles_id_fk" FOREIGN KEY ("follower_profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_followed_profile_id_profiles_id_fk" FOREIGN KEY ("followed_profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "likes" ADD CONSTRAINT "likes_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "likes" ADD CONSTRAINT "likes_thread_item_id_thread_items_id_fk" FOREIGN KEY ("thread_item_id") REFERENCES "public"."thread_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "answer_like_notifications_actor_item_owner_unique" ON "answer_like_notifications" USING btree ("actor_user_id","thread_item_id","owner_user_id");--> statement-breakpoint
CREATE INDEX "answer_like_notifications_owner_created_idx" ON "answer_like_notifications" USING btree ("owner_user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "follows_follower_followed_unique" ON "follows" USING btree ("follower_profile_id","followed_profile_id");--> statement-breakpoint
CREATE INDEX "follows_follower_created_idx" ON "follows" USING btree ("follower_profile_id","created_at");--> statement-breakpoint
CREATE INDEX "follows_followed_created_idx" ON "follows" USING btree ("followed_profile_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "likes_profile_thread_item_unique" ON "likes" USING btree ("profile_id","thread_item_id");--> statement-breakpoint
CREATE INDEX "likes_thread_item_created_idx" ON "likes" USING btree ("thread_item_id","created_at");--> statement-breakpoint
CREATE INDEX "likes_profile_created_idx" ON "likes" USING btree ("profile_id","created_at");
