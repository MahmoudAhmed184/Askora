CREATE TYPE "public"."ask_permission" AS ENUM('everyone', 'logged_in', 'followers', 'off');--> statement-breakpoint
CREATE TYPE "public"."follow_up_permission" AS ENUM('anyone', 'logged_in', 'original_asker', 'off');--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"username" text NOT NULL,
	"display_name" text NOT NULL,
	"avatar_url" text,
	"bio" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"accepting_questions" boolean DEFAULT true NOT NULL,
	"anonymous_questions_enabled" boolean DEFAULT true NOT NULL,
	"ask_permission" "ask_permission" DEFAULT 'everyone' NOT NULL,
	"follow_up_permission_default" "follow_up_permission" DEFAULT 'anyone' NOT NULL,
	"show_follower_counts" boolean DEFAULT true NOT NULL,
	"show_like_counts" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "username_reservations" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"profile_id" text NOT NULL,
	"redirect_to_username" text,
	"reserved_until" timestamp with time zone,
	"redirect_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "username_reservations" ADD CONSTRAINT "username_reservations_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_user_id_unique" ON "profiles" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_username_active_unique" ON "profiles" USING btree ("username") WHERE "profiles"."is_active" = true;--> statement-breakpoint
CREATE INDEX "profiles_user_id_idx" ON "profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "profiles_username_idx" ON "profiles" USING btree ("username");--> statement-breakpoint
CREATE INDEX "profiles_active_username_idx" ON "profiles" USING btree ("is_active","username");--> statement-breakpoint
CREATE UNIQUE INDEX "username_reservations_username_unique" ON "username_reservations" USING btree ("username");--> statement-breakpoint
CREATE INDEX "username_reservations_profile_id_idx" ON "username_reservations" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "username_reservations_redirect_to_username_idx" ON "username_reservations" USING btree ("redirect_to_username");--> statement-breakpoint
CREATE INDEX "username_reservations_reserved_until_idx" ON "username_reservations" USING btree ("reserved_until");