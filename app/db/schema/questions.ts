import { relations, sql } from "drizzle-orm";
import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { authUsers } from "~/db/schema/auth";
import { profiles } from "~/db/schema/profiles";

export const questionStatusEnum = pgEnum("question_status", [
  "inbox",
  "filtered",
  "draft",
  "answered",
]);

export const questionIdentityModeEnum = pgEnum("question_identity_mode", [
  "guest_anonymous",
  "account_anonymous",
  "account_attributed",
]);

export const questionSourceEnum = pgEnum("question_source", ["public_profile"]);

export const questionDeletedByEnum = pgEnum("question_deleted_by", [
  "asker",
  "recipient",
  "moderator",
]);

export const questions = pgTable(
  "questions",
  {
    id: text("id").primaryKey(),
    publicId: text("public_id").notNull(),
    recipientProfileId: text("recipient_profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    recipientUserId: text("recipient_user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    askerUserId: text("asker_user_id").references(() => authUsers.id, {
      onDelete: "set null",
    }),
    askerProfileId: text("asker_profile_id").references(() => profiles.id, {
      onDelete: "set null",
    }),
    identityMode: questionIdentityModeEnum("identity_mode").notNull(),
    source: questionSourceEnum("source").notNull().default("public_profile"),
    status: questionStatusEnum("status").notNull().default("inbox"),
    threadId: text("thread_id"),
    originalText: text("original_text").notNull(),
    normalizedTextHash: text("normalized_text_hash").notNull(),
    ipHash: text("ip_hash"),
    userAgentHash: text("user_agent_hash"),
    safetyFingerprintHash: text("safety_fingerprint_hash").notNull(),
    safetyMetadataRetainUntil: timestamp("safety_metadata_retain_until", {
      withTimezone: true,
    }).notNull(),
    anonymizedAt: timestamp("anonymized_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: questionDeletedByEnum("deleted_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("questions_public_id_unique").on(table.publicId),
    index("questions_recipient_inbox_idx")
      .on(table.recipientProfileId, table.createdAt)
      .where(sql`${table.status} = 'inbox' and ${table.deletedAt} is null`),
    index("questions_asker_regret_idx").on(
      table.askerUserId,
      table.status,
      table.deletedAt,
      table.createdAt,
    ),
    index("questions_recipient_status_created_idx").on(
      table.recipientProfileId,
      table.status,
      table.createdAt,
    ),
    index("questions_thread_id_idx").on(table.threadId),
    index("questions_ip_hash_idx")
      .on(table.ipHash)
      .where(sql`${table.ipHash} is not null`),
    index("questions_safety_fingerprint_idx").on(table.safetyFingerprintHash),
    index("questions_normalized_text_hash_idx").on(table.normalizedTextHash),
  ],
);

export const questionsRelations = relations(questions, ({ one }) => ({
  recipientProfile: one(profiles, {
    fields: [questions.recipientProfileId],
    references: [profiles.id],
  }),
  recipientUser: one(authUsers, {
    fields: [questions.recipientUserId],
    references: [authUsers.id],
  }),
  askerUser: one(authUsers, {
    fields: [questions.askerUserId],
    references: [authUsers.id],
  }),
  askerProfile: one(profiles, {
    fields: [questions.askerProfileId],
    references: [profiles.id],
  }),
}));
