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
import {
  moderationReportReasonValues,
  moderationReportStatusValues,
  moderationReportTargetTypeValues,
} from "~/db/schema/moderation-values";
import { profiles } from "~/db/schema/profiles";
import { questions } from "~/db/schema/questions";

export {
  moderationReportReasonValues,
  moderationReportStatusValues,
  moderationReportTargetTypeValues,
} from "~/db/schema/moderation-values";

export const moderationReportTargetTypeEnum = pgEnum(
  "moderation_report_target_type",
  moderationReportTargetTypeValues,
);

export const moderationReportReasonEnum = pgEnum(
  "moderation_report_reason",
  moderationReportReasonValues,
);

export const moderationReportStatusEnum = pgEnum(
  "moderation_report_status",
  moderationReportStatusValues,
);

export const reports = pgTable(
  "reports",
  {
    id: text("id").primaryKey(),
    reporterUserId: text("reporter_user_id").references(() => authUsers.id, {
      onDelete: "set null",
    }),
    reporterProfileId: text("reporter_profile_id").references(() => profiles.id, {
      onDelete: "set null",
    }),
    targetType: moderationReportTargetTypeEnum("target_type").notNull(),
    targetId: text("target_id").notNull(),
    reason: moderationReportReasonEnum("reason").notNull(),
    details: text("details"),
    status: moderationReportStatusEnum("status").notNull().default("open"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("reports_reporter_user_id_idx").on(table.reporterUserId),
    index("reports_reporter_profile_id_idx").on(table.reporterProfileId),
    index("reports_target_idx").on(table.targetType, table.targetId),
    index("reports_status_created_idx").on(table.status, table.createdAt),
  ],
);

export const blocks = pgTable(
  "blocks",
  {
    id: text("id").primaryKey(),
    ownerProfileId: text("owner_profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    blockedUserId: text("blocked_user_id").references(() => authUsers.id, {
      onDelete: "set null",
    }),
    blockedProfileId: text("blocked_profile_id").references(() => profiles.id, {
      onDelete: "set null",
    }),
    safetyFingerprintHash: text("safety_fingerprint_hash"),
    ipHash: text("ip_hash"),
    sourceQuestionId: text("source_question_id").references(() => questions.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("blocks_owner_profile_id_idx").on(table.ownerProfileId),
    index("blocks_blocked_user_id_idx").on(table.blockedUserId),
    index("blocks_blocked_profile_id_idx").on(table.blockedProfileId),
    index("blocks_safety_fingerprint_idx").on(table.safetyFingerprintHash),
    uniqueIndex("blocks_owner_blocked_user_unique")
      .on(table.ownerProfileId, table.blockedUserId)
      .where(sql`${table.blockedUserId} is not null`),
    uniqueIndex("blocks_owner_blocked_profile_unique")
      .on(table.ownerProfileId, table.blockedProfileId)
      .where(sql`${table.blockedProfileId} is not null`),
    uniqueIndex("blocks_owner_fingerprint_unique")
      .on(table.ownerProfileId, table.safetyFingerprintHash)
      .where(sql`${table.safetyFingerprintHash} is not null`),
  ],
);

export const mutedPhrases = pgTable(
  "muted_phrases",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    phrase: text("phrase").notNull(),
    normalizedPhrase: text("normalized_phrase").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("muted_phrases_profile_id_idx").on(table.profileId),
    uniqueIndex("muted_phrases_profile_normalized_unique").on(
      table.profileId,
      table.normalizedPhrase,
    ),
  ],
);

export const reportsRelations = relations(reports, ({ one }) => ({
  reporterUser: one(authUsers, {
    fields: [reports.reporterUserId],
    references: [authUsers.id],
  }),
  reporterProfile: one(profiles, {
    fields: [reports.reporterProfileId],
    references: [profiles.id],
  }),
}));

export const blocksRelations = relations(blocks, ({ one }) => ({
  ownerProfile: one(profiles, {
    fields: [blocks.ownerProfileId],
    references: [profiles.id],
  }),
  ownerUser: one(authUsers, {
    fields: [blocks.ownerUserId],
    references: [authUsers.id],
  }),
  blockedUser: one(authUsers, {
    fields: [blocks.blockedUserId],
    references: [authUsers.id],
  }),
  blockedProfile: one(profiles, {
    fields: [blocks.blockedProfileId],
    references: [profiles.id],
  }),
  sourceQuestion: one(questions, {
    fields: [blocks.sourceQuestionId],
    references: [questions.id],
  }),
}));

export const mutedPhrasesRelations = relations(mutedPhrases, ({ one }) => ({
  profile: one(profiles, {
    fields: [mutedPhrases.profileId],
    references: [profiles.id],
  }),
}));
