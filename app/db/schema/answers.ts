import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { authUsers } from "~/db/schema/auth";
import { followUpPermissionEnum, profiles } from "~/db/schema/profiles";
import { questions } from "~/db/schema/questions";

export const threadStatusValues = [
  "draft",
  "published",
  "unpublished",
  "deleted",
] as const;

export const threadItemStatusValues = [
  "draft",
  "published",
  "unpublished",
  "deleted",
] as const;

export const questionTextModeValues = [
  "original",
  "edited",
  "hidden",
] as const;

export const notificationTypeValues = [
  "question_answered",
  "follow_up_asked",
  "follow_up_answered",
  "answer_liked",
  "profile_followed",
] as const;
export const threadItemDeletedByValues = ["owner", "admin"] as const;

export const threadStatusEnum = pgEnum("thread_status", threadStatusValues);
export const threadItemStatusEnum = pgEnum(
  "thread_item_status",
  threadItemStatusValues,
);
export const questionTextModeEnum = pgEnum(
  "question_text_mode",
  questionTextModeValues,
);
export const notificationTypeEnum = pgEnum(
  "notification_type",
  notificationTypeValues,
);
export const threadItemDeletedByEnum = pgEnum(
  "thread_item_deleted_by",
  threadItemDeletedByValues,
);

export const threads = pgTable(
  "threads",
  {
    id: text("id").primaryKey(),
    publicId: text("public_id").notNull(),
    ownerProfileId: text("owner_profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    initialQuestionId: text("initial_question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    status: threadStatusEnum("status").notNull().default("draft"),
    followUpPermissionOverride: followUpPermissionEnum(
      "follow_up_permission_override",
    ),
    followUpsEnabled: boolean("follow_ups_enabled").notNull().default(true),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("threads_public_id_unique").on(table.publicId),
    uniqueIndex("threads_initial_question_id_unique").on(
      table.initialQuestionId,
    ),
    index("threads_owner_status_published_idx").on(
      table.ownerProfileId,
      table.status,
      table.publishedAt,
    ),
    index("threads_owner_draft_updated_idx")
      .on(table.ownerProfileId, table.updatedAt)
      .where(sql`${table.status} = 'draft'`),
  ],
);

export const threadItems = pgTable(
  "thread_items",
  {
    id: text("id").primaryKey(),
    publicId: text("public_id").notNull(),
    threadId: text("thread_id")
      .notNull()
      .references(() => threads.id, { onDelete: "cascade" }),
    questionId: text("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    answerText: text("answer_text").notNull(),
    displayQuestionText: text("display_question_text"),
    questionTextMode: questionTextModeEnum("question_text_mode")
      .notNull()
      .default("original"),
    status: threadItemStatusEnum("status").notNull().default("draft"),
    position: integer("position").notNull().default(0),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: threadItemDeletedByEnum("deleted_by"),
  },
  (table) => [
    uniqueIndex("thread_items_public_id_unique").on(table.publicId),
    uniqueIndex("thread_items_question_id_unique").on(table.questionId),
    index("thread_items_thread_status_position_idx").on(
      table.threadId,
      table.status,
      table.position,
    ),
    index("thread_items_published_idx")
      .on(table.status, table.publishedAt)
      .where(sql`${table.deletedAt} is null`),
  ],
);

export const pinnedAnswers = pgTable(
  "pinned_answers",
  {
    profileId: text("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    threadItemId: text("thread_item_id")
      .notNull()
      .references(() => threadItems.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("pinned_answers_profile_position_unique").on(
      table.profileId,
      table.position,
    ),
    uniqueIndex("pinned_answers_profile_thread_item_unique").on(
      table.profileId,
      table.threadItemId,
    ),
  ],
);

export const notifications = pgTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    recipientUserId: text("recipient_user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    type: notificationTypeEnum("type").notNull(),
    actorUserId: text("actor_user_id").references(() => authUsers.id, {
      onDelete: "set null",
    }),
    threadId: text("thread_id").references(() => threads.id, {
      onDelete: "set null",
    }),
    threadItemId: text("thread_item_id").references(() => threadItems.id, {
      onDelete: "set null",
    }),
    questionId: text("question_id").references(() => questions.id, {
      onDelete: "set null",
    }),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("notifications_recipient_created_idx").on(
      table.recipientUserId,
      table.createdAt,
    ),
    index("notifications_recipient_read_idx").on(
      table.recipientUserId,
      table.readAt,
    ),
    uniqueIndex("notifications_question_answered_unique")
      .on(table.recipientUserId, table.type, table.questionId)
      .where(
        sql`${table.type} = 'question_answered' and ${table.questionId} is not null`,
      ),
    uniqueIndex("notifications_follow_up_asked_unique")
      .on(table.recipientUserId, table.type, table.questionId)
      .where(
        sql`${table.type} = 'follow_up_asked' and ${table.questionId} is not null`,
      ),
    uniqueIndex("notifications_follow_up_answered_unique")
      .on(table.recipientUserId, table.type, table.threadItemId)
      .where(
        sql`${table.type} = 'follow_up_answered' and ${table.threadItemId} is not null`,
      ),
    uniqueIndex("notifications_profile_followed_unique")
      .on(table.recipientUserId, table.type, table.actorUserId)
      .where(
        sql`${table.type} = 'profile_followed' and ${table.actorUserId} is not null`,
      ),
  ],
);

export const threadsRelations = relations(threads, ({ many, one }) => ({
  ownerProfile: one(profiles, {
    fields: [threads.ownerProfileId],
    references: [profiles.id],
  }),
  initialQuestion: one(questions, {
    fields: [threads.initialQuestionId],
    references: [questions.id],
  }),
  items: many(threadItems),
  notifications: many(notifications),
}));

export const threadItemsRelations = relations(threadItems, ({ many, one }) => ({
  thread: one(threads, {
    fields: [threadItems.threadId],
    references: [threads.id],
  }),
  question: one(questions, {
    fields: [threadItems.questionId],
    references: [questions.id],
  }),
  notifications: many(notifications),
  pins: many(pinnedAnswers),
}));

export const pinnedAnswersRelations = relations(pinnedAnswers, ({ one }) => ({
  profile: one(profiles, {
    fields: [pinnedAnswers.profileId],
    references: [profiles.id],
  }),
  threadItem: one(threadItems, {
    fields: [pinnedAnswers.threadItemId],
    references: [threadItems.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  recipientUser: one(authUsers, {
    fields: [notifications.recipientUserId],
    references: [authUsers.id],
  }),
  actorUser: one(authUsers, {
    fields: [notifications.actorUserId],
    references: [authUsers.id],
  }),
  thread: one(threads, {
    fields: [notifications.threadId],
    references: [threads.id],
  }),
  threadItem: one(threadItems, {
    fields: [notifications.threadItemId],
    references: [threadItems.id],
  }),
  question: one(questions, {
    fields: [notifications.questionId],
    references: [questions.id],
  }),
}));
