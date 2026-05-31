import { relations } from "drizzle-orm";
import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { authUsers } from "~/db/schema/auth";
import { profiles } from "~/db/schema/profiles";
import { threadItems } from "~/db/schema/answers";

export const follows = pgTable(
  "follows",
  {
    followerProfileId: text("follower_profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    followedProfileId: text("followed_profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("follows_follower_followed_unique").on(
      table.followerProfileId,
      table.followedProfileId,
    ),
    index("follows_follower_created_idx").on(
      table.followerProfileId,
      table.createdAt,
    ),
    index("follows_followed_created_idx").on(
      table.followedProfileId,
      table.createdAt,
    ),
  ],
);

export const likes = pgTable(
  "likes",
  {
    profileId: text("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    threadItemId: text("thread_item_id")
      .notNull()
      .references(() => threadItems.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("likes_profile_thread_item_unique").on(
      table.profileId,
      table.threadItemId,
    ),
    index("likes_thread_item_created_idx").on(
      table.threadItemId,
      table.createdAt,
    ),
    index("likes_profile_created_idx").on(table.profileId, table.createdAt),
  ],
);

export const answerLikeNotifications = pgTable(
  "answer_like_notifications",
  {
    actorUserId: text("actor_user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    threadItemId: text("thread_item_id")
      .notNull()
      .references(() => threadItems.id, { onDelete: "cascade" }),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("answer_like_notifications_actor_item_owner_unique").on(
      table.actorUserId,
      table.threadItemId,
      table.ownerUserId,
    ),
    index("answer_like_notifications_owner_created_idx").on(
      table.ownerUserId,
      table.createdAt,
    ),
  ],
);

export const followsRelations = relations(follows, ({ one }) => ({
  followerProfile: one(profiles, {
    fields: [follows.followerProfileId],
    references: [profiles.id],
  }),
  followedProfile: one(profiles, {
    fields: [follows.followedProfileId],
    references: [profiles.id],
  }),
}));

export const likesRelations = relations(likes, ({ one }) => ({
  profile: one(profiles, {
    fields: [likes.profileId],
    references: [profiles.id],
  }),
  threadItem: one(threadItems, {
    fields: [likes.threadItemId],
    references: [threadItems.id],
  }),
}));

export const answerLikeNotificationsRelations = relations(
  answerLikeNotifications,
  ({ one }) => ({
    actorUser: one(authUsers, {
      fields: [answerLikeNotifications.actorUserId],
      references: [authUsers.id],
    }),
    ownerUser: one(authUsers, {
      fields: [answerLikeNotifications.ownerUserId],
      references: [authUsers.id],
    }),
    threadItem: one(threadItems, {
      fields: [answerLikeNotifications.threadItemId],
      references: [threadItems.id],
    }),
  }),
);
