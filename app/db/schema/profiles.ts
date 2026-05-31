import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { authUsers } from "~/db/schema/auth";

export const askPermissionEnum = pgEnum("ask_permission", [
  "everyone",
  "logged_in",
  "followers",
  "off",
]);

export const followUpPermissionEnum = pgEnum("follow_up_permission", [
  "anyone",
  "logged_in",
  "original_asker",
  "off",
]);

export const profileDeactivationReasonEnum = pgEnum(
  "profile_deactivation_reason",
  ["user", "account_deletion", "admin"],
);

export const profiles = pgTable(
  "profiles",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    username: text("username").notNull(),
    displayName: text("display_name").notNull(),
    avatarUrl: text("avatar_url"),
    bio: text("bio"),
    isActive: boolean("is_active").notNull().default(true),
    acceptingQuestions: boolean("accepting_questions").notNull().default(true),
    anonymousQuestionsEnabled: boolean("anonymous_questions_enabled")
      .notNull()
      .default(true),
    askPermission: askPermissionEnum("ask_permission")
      .notNull()
      .default("everyone"),
    followUpPermissionDefault: followUpPermissionEnum(
      "follow_up_permission_default",
    )
      .notNull()
      .default("anyone"),
    showFollowerCounts: boolean("show_follower_counts").notNull().default(true),
    showLikeCounts: boolean("show_like_counts").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deactivatedAt: timestamp("deactivated_at", { withTimezone: true }),
    deactivationReason: profileDeactivationReasonEnum("deactivation_reason"),
  },
  (table) => [
    uniqueIndex("profiles_user_id_unique").on(table.userId),
    uniqueIndex("profiles_username_active_unique")
      .on(table.username)
      .where(sql`${table.isActive} = true`),
    index("profiles_user_id_idx").on(table.userId),
    index("profiles_username_idx").on(table.username),
    index("profiles_active_username_idx").on(table.isActive, table.username),
    index("profiles_deactivation_reason_idx").on(table.deactivationReason),
  ],
);

export const usernameReservations = pgTable(
  "username_reservations",
  {
    id: text("id").primaryKey(),
    username: text("username").notNull(),
    profileId: text("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    redirectToUsername: text("redirect_to_username"),
    reservedUntil: timestamp("reserved_until", { withTimezone: true }),
    redirectUntil: timestamp("redirect_until", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("username_reservations_username_unique").on(table.username),
    index("username_reservations_profile_id_idx").on(table.profileId),
    index("username_reservations_redirect_to_username_idx").on(
      table.redirectToUsername,
    ),
    index("username_reservations_reserved_until_idx").on(table.reservedUntil),
  ],
);

export const profilesRelations = relations(profiles, ({ many, one }) => ({
  user: one(authUsers, {
    fields: [profiles.userId],
    references: [authUsers.id],
  }),
  usernameReservations: many(usernameReservations),
}));

export const usernameReservationsRelations = relations(
  usernameReservations,
  ({ one }) => ({
    profile: one(profiles, {
      fields: [usernameReservations.profileId],
      references: [profiles.id],
    }),
  }),
);
