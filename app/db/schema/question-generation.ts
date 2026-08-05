import { relations, sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { authUsers } from "~/db/schema/auth";
import { profiles } from "~/db/schema/profiles";

export const questionGenerationModelPreferenceEnum = pgEnum(
  "question_generation_model_preference",
  ["auto", "gemini-3.6-flash", "gemini-3.1-flash-lite"],
);

export const questionGenerationLanguageEnum = pgEnum(
  "question_generation_language",
  ["egyptian_arabic", "modern_standard_arabic", "english"],
);

export const questionGenerationStyleEnum = pgEnum("question_generation_style", [
  "balanced",
  "deep_reflective",
  "professional",
  "personal",
  "light_fun",
  "surprise_me",
]);

export const questionGenerationSettings = pgTable(
  "question_generation_settings",
  {
    ownerUserId: text("owner_user_id")
      .primaryKey()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    geminiKeyCiphertext: text("gemini_key_ciphertext"),
    geminiKeyNonce: text("gemini_key_nonce"),
    geminiKeyAuthTag: text("gemini_key_auth_tag"),
    geminiKeyVersion: integer("gemini_key_version"),
    modelPreference: questionGenerationModelPreferenceEnum("model_preference")
      .notNull()
      .default("auto"),
    questionInterests: text("question_interests")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    credentialValidatedAt: timestamp("credential_validated_at", {
      withTimezone: true,
    }),
    dataDisclosureVersion: integer("data_disclosure_version"),
    dataDisclosureAcceptedAt: timestamp("data_disclosure_accepted_at", {
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "question_generation_settings_credential_material_check",
      sql`
        (
          ${table.geminiKeyCiphertext} is null
          and ${table.geminiKeyNonce} is null
          and ${table.geminiKeyAuthTag} is null
          and ${table.geminiKeyVersion} is null
        ) or (
          ${table.geminiKeyCiphertext} is not null
          and ${table.geminiKeyNonce} is not null
          and ${table.geminiKeyAuthTag} is not null
          and ${table.geminiKeyVersion} is not null
        )`,
    ),
  ],
);

export const questionGenerationBatches = pgTable(
  "question_generation_batches",
  {
    id: text("id").primaryKey(),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    profileId: text("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    language: questionGenerationLanguageEnum("language").notNull(),
    style: questionGenerationStyleEnum("style").notNull(),
    requestedCount: integer("requested_count").notNull(),
    modelUsed: text("model_used").notNull(),
    promptTokenCount: integer("prompt_token_count"),
    candidateTokenCount: integer("candidate_token_count"),
    totalTokenCount: integer("total_token_count"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("question_generation_batches_owner_created_idx").on(
      table.ownerUserId,
      table.createdAt,
    ),
    index("question_generation_batches_profile_created_idx").on(
      table.profileId,
      table.createdAt,
    ),
    check(
      "question_generation_batches_requested_count_check",
      sql`${table.requestedCount} in (3, 5, 10)`,
    ),
    check(
      "question_generation_batches_model_used_check",
      sql`${table.modelUsed} in ('gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.1-flash-lite')`,
    ),
    check(
      "question_generation_batches_token_counts_check",
      sql`
        (${table.promptTokenCount} is null or ${table.promptTokenCount} >= 0)
        and (${table.candidateTokenCount} is null or ${table.candidateTokenCount} >= 0)
        and (${table.totalTokenCount} is null or ${table.totalTokenCount} >= 0)`,
    ),
  ],
);

export const questionGenerationSettingsRelations = relations(
  questionGenerationSettings,
  ({ one }) => ({
    ownerUser: one(authUsers, {
      fields: [questionGenerationSettings.ownerUserId],
      references: [authUsers.id],
    }),
  }),
);

export const questionGenerationBatchesRelations = relations(
  questionGenerationBatches,
  ({ one }) => ({
    ownerUser: one(authUsers, {
      fields: [questionGenerationBatches.ownerUserId],
      references: [authUsers.id],
    }),
    profile: one(profiles, {
      fields: [questionGenerationBatches.profileId],
      references: [profiles.id],
    }),
  }),
);
