import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";

import { getRuntimeDatabase, type RuntimeDatabase } from "~/db/client.server";
import {
  events,
  mutedPhrases,
  pinnedAnswers,
  profiles,
  questionGenerationBatches,
  questionGenerationSettings,
  questions,
  threadItems,
  threads,
} from "~/db/schema";
import type { QuestionGenerationModelPreference } from "~/features/question-generation/question-generation.constants";
import type { StoredQuestionGenerationCredential } from "~/features/question-generation/question-generation.crypto.server";
import { QuestionGenerationError } from "~/features/question-generation/question-generation.errors";
import { createDatabaseId } from "~/lib/ids.server";

export interface QuestionGenerationOwnedProfile {
  id: string;
  userId: string;
  displayName: string;
  bio: string | null;
  isActive: boolean;
}

export interface StoredQuestionGenerationPublishedPair {
  id: string;
  question: string;
  answer: string;
  pinned: boolean;
  publishedAt: Date;
}

export interface GeneratedQuestionPersistenceInput {
  ownerUserId: string;
  profileId: string;
  language: "egyptian_arabic" | "modern_standard_arabic" | "english";
  style:
    | "balanced"
    | "deep_reflective"
    | "professional"
    | "personal"
    | "light_fun"
    | "surprise_me";
  requestedCount: 3 | 5 | 10;
  modelUsed: string;
  usage: {
    promptTokenCount: number | undefined;
    candidateTokenCount: number | undefined;
    totalTokenCount: number | undefined;
  };
  questions: { id: string; publicId: string; text: string; normalizedTextHash: string }[];
  batchId: string;
  now: Date;
}

export interface QuestionGenerationRepository extends QuestionGenerationSettingsRepository {
  findOwnedActiveProfile(params: {
    ownerUserId: string;
    profileId: string;
  }): Promise<QuestionGenerationOwnedProfile | undefined>;
  findPublishedPairs(profileId: string): Promise<StoredQuestionGenerationPublishedPair[]>;
  findExistingNormalizedTextHashes(params: {
    profileId: string;
    hashes: string[];
  }): Promise<string[]>;
  findMutedPhrases(profileId: string): Promise<string[]>;
  persistGeneratedBatch(params: GeneratedQuestionPersistenceInput): Promise<void>;
}

export interface StoredQuestionGenerationSettings {
  ownerUserId: string;
  geminiKeyCiphertext: string | null;
  geminiKeyNonce: string | null;
  geminiKeyAuthTag: string | null;
  geminiKeyVersion: number | null;
  modelPreference: QuestionGenerationModelPreference;
  questionInterests: string[];
  credentialValidatedAt: Date | null;
  dataDisclosureVersion: number | null;
  dataDisclosureAcceptedAt: Date | null;
}

export interface QuestionGenerationSettingsRepository {
  findSettings(ownerUserId: string): Promise<StoredQuestionGenerationSettings | undefined>;
  savePreferences(params: {
    ownerUserId: string;
    modelPreference: QuestionGenerationModelPreference;
    questionInterests: string[];
    now: Date;
  }): Promise<void>;
  saveValidatedCredential(params: {
    ownerUserId: string;
    profileId: string;
    modelPreference: QuestionGenerationModelPreference;
    material: StoredQuestionGenerationCredential;
    action: "credential_connected" | "credential_replaced";
    now: Date;
  }): Promise<void>;
  clearCredential(params: {
    ownerUserId: string;
    profileId: string;
    now: Date;
  }): Promise<void>;
  saveDisclosureAcknowledgement(params: {
    ownerUserId: string;
    disclosureVersion: number;
    now: Date;
  }): Promise<void>;
  replaceCredentialMaterial(params: {
    ownerUserId: string;
    material: StoredQuestionGenerationCredential;
    now: Date;
  }): Promise<void>;
  recordSecurityEvent(params: {
    ownerUserId: string;
    profileId: string;
    action: "credential_connected" | "credential_disconnected" | "credential_replaced";
    outcome: "success" | "failure";
    now: Date;
  }): Promise<void>;
}

export function createDrizzleQuestionGenerationSettingsRepository(
  database: RuntimeDatabase = getRuntimeDatabase(),
): QuestionGenerationSettingsRepository {
  return {
    async findSettings(ownerUserId) {
      const [settings] = await database
        .select({
          ownerUserId: questionGenerationSettings.ownerUserId,
          geminiKeyCiphertext: questionGenerationSettings.geminiKeyCiphertext,
          geminiKeyNonce: questionGenerationSettings.geminiKeyNonce,
          geminiKeyAuthTag: questionGenerationSettings.geminiKeyAuthTag,
          geminiKeyVersion: questionGenerationSettings.geminiKeyVersion,
          modelPreference: questionGenerationSettings.modelPreference,
          questionInterests: questionGenerationSettings.questionInterests,
          credentialValidatedAt:
            questionGenerationSettings.credentialValidatedAt,
          dataDisclosureVersion: questionGenerationSettings.dataDisclosureVersion,
          dataDisclosureAcceptedAt:
            questionGenerationSettings.dataDisclosureAcceptedAt,
        })
        .from(questionGenerationSettings)
        .where(eq(questionGenerationSettings.ownerUserId, ownerUserId))
        .limit(1);

      return settings;
    },
    async savePreferences({ modelPreference, now, ownerUserId, questionInterests }) {
      await database
        .insert(questionGenerationSettings)
        .values({
          ownerUserId,
          modelPreference,
          questionInterests,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: questionGenerationSettings.ownerUserId,
          set: { modelPreference, questionInterests, updatedAt: now },
        });
    },
    async saveValidatedCredential({
      action,
      material,
      modelPreference,
      now,
      ownerUserId,
      profileId,
    }) {
      await database.transaction(async (transaction) => {
        await transaction
          .insert(questionGenerationSettings)
          .values({
            ownerUserId,
            modelPreference,
            geminiKeyCiphertext: material.ciphertext,
            geminiKeyNonce: material.nonce,
            geminiKeyAuthTag: material.authTag,
            geminiKeyVersion: material.keyVersion,
            credentialValidatedAt: now,
            createdAt: now,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: questionGenerationSettings.ownerUserId,
            set: {
              modelPreference,
              geminiKeyCiphertext: material.ciphertext,
              geminiKeyNonce: material.nonce,
              geminiKeyAuthTag: material.authTag,
              geminiKeyVersion: material.keyVersion,
              credentialValidatedAt: now,
              updatedAt: now,
            },
          });
        await transaction.insert(events).values({
          id: createDatabaseId(),
          userId: ownerUserId,
          profileId,
          type: "question_generation_credential",
          metadata: { action, outcome: "success" },
          createdAt: now,
        });
      });
    },
    async clearCredential({ now, ownerUserId, profileId }) {
      await database.transaction(async (transaction) => {
        await transaction
          .update(questionGenerationSettings)
          .set({
            geminiKeyCiphertext: null,
            geminiKeyNonce: null,
            geminiKeyAuthTag: null,
            geminiKeyVersion: null,
            credentialValidatedAt: null,
            updatedAt: now,
          })
          .where(eq(questionGenerationSettings.ownerUserId, ownerUserId));
        await transaction.insert(events).values({
          id: createDatabaseId(),
          userId: ownerUserId,
          profileId,
          type: "question_generation_credential",
          metadata: { action: "credential_disconnected", outcome: "success" },
          createdAt: now,
        });
      });
    },
    async saveDisclosureAcknowledgement({ disclosureVersion, now, ownerUserId }) {
      await database
        .insert(questionGenerationSettings)
        .values({
          ownerUserId,
          dataDisclosureVersion: disclosureVersion,
          dataDisclosureAcceptedAt: now,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: questionGenerationSettings.ownerUserId,
          set: {
            dataDisclosureVersion: disclosureVersion,
            dataDisclosureAcceptedAt: now,
            updatedAt: now,
          },
        });
    },
    async replaceCredentialMaterial({ material, now, ownerUserId }) {
      await database
        .update(questionGenerationSettings)
        .set({
          geminiKeyCiphertext: material.ciphertext,
          geminiKeyNonce: material.nonce,
          geminiKeyAuthTag: material.authTag,
          geminiKeyVersion: material.keyVersion,
          updatedAt: now,
        })
        .where(eq(questionGenerationSettings.ownerUserId, ownerUserId));
    },
    async recordSecurityEvent({ action, now, outcome, ownerUserId, profileId }) {
      await database.insert(events).values({
        id: createDatabaseId(),
        userId: ownerUserId,
        profileId,
        type: "question_generation_credential",
        metadata: { action, outcome },
        createdAt: now,
      });
    },
  };
}

export function createDrizzleQuestionGenerationRepository(
  database: RuntimeDatabase = getRuntimeDatabase(),
): QuestionGenerationRepository {
  const settingsRepository = createDrizzleQuestionGenerationSettingsRepository(database);

  return {
    ...settingsRepository,
    async findOwnedActiveProfile({ ownerUserId, profileId }) {
      const [profile] = await database
        .select({
          id: profiles.id,
          userId: profiles.userId,
          displayName: profiles.displayName,
          bio: profiles.bio,
          isActive: profiles.isActive,
        })
        .from(profiles)
        .where(
          and(
            eq(profiles.id, profileId),
            eq(profiles.userId, ownerUserId),
            eq(profiles.isActive, true),
          ),
        )
        .limit(1);

      return profile;
    },
    async findPublishedPairs(profileId) {
      const rows = await database
        .select({
          id: threadItems.id,
          question: questions.originalText,
          answer: threadItems.answerText,
          pinPosition: pinnedAnswers.position,
          publishedAt: threadItems.publishedAt,
        })
        .from(threadItems)
        .innerJoin(questions, eq(questions.id, threadItems.questionId))
        .innerJoin(threads, eq(threads.id, threadItems.threadId))
        .leftJoin(
          pinnedAnswers,
          and(
            eq(pinnedAnswers.profileId, profileId),
            eq(pinnedAnswers.threadItemId, threadItems.id),
          ),
        )
        .where(
          and(
            eq(questions.recipientProfileId, profileId),
            eq(questions.status, "answered"),
            isNull(questions.deletedAt),
            eq(threads.ownerProfileId, profileId),
            eq(threads.status, "published"),
            eq(threadItems.status, "published"),
            isNull(threadItems.deletedAt),
          ),
        )
        .orderBy(
          asc(pinnedAnswers.position),
          desc(threadItems.publishedAt),
          desc(threadItems.createdAt),
        )
        .limit(20);

      return rows.flatMap((row) =>
        row.publishedAt === null
          ? []
          : [{
              id: row.id,
              question: row.question,
              answer: row.answer,
              pinned: row.pinPosition !== null,
              publishedAt: row.publishedAt,
            }],
      );
    },
    async findExistingNormalizedTextHashes({ hashes, profileId }) {
      if (hashes.length === 0) return [];

      const rows = await database
        .select({ normalizedTextHash: questions.normalizedTextHash })
        .from(questions)
        .where(
          and(
            eq(questions.recipientProfileId, profileId),
            inArray(questions.normalizedTextHash, hashes),
            isNull(questions.deletedAt),
          ),
        );

      return rows.map((row) => row.normalizedTextHash);
    },
    async findMutedPhrases(profileId) {
      const rows = await database
        .select({ normalizedPhrase: mutedPhrases.normalizedPhrase })
        .from(mutedPhrases)
        .where(eq(mutedPhrases.profileId, profileId));

      return rows.map((row) => row.normalizedPhrase);
    },
    async persistGeneratedBatch(params) {
      await database.transaction(async (transaction) => {
        const [profile] = await transaction
          .select({ id: profiles.id })
          .from(profiles)
          .where(
            and(
              eq(profiles.id, params.profileId),
              eq(profiles.userId, params.ownerUserId),
              eq(profiles.isActive, true),
            ),
          )
          .for("update")
          .limit(1);

        if (profile === undefined) {
          throw new QuestionGenerationError("profile_unavailable");
        }

        const hashes = params.questions.map((question) => question.normalizedTextHash);
        const existing = await transaction
          .select({ normalizedTextHash: questions.normalizedTextHash })
          .from(questions)
          .where(
            and(
              eq(questions.recipientProfileId, params.profileId),
              inArray(questions.normalizedTextHash, hashes),
              isNull(questions.deletedAt),
            ),
          );

        if (existing.length > 0) {
          throw new QuestionGenerationError("duplicate");
        }

        await transaction.insert(questionGenerationBatches).values({
          id: params.batchId,
          ownerUserId: params.ownerUserId,
          profileId: params.profileId,
          language: params.language,
          style: params.style,
          requestedCount: params.requestedCount,
          modelUsed: params.modelUsed,
          promptTokenCount: params.usage.promptTokenCount,
          candidateTokenCount: params.usage.candidateTokenCount,
          totalTokenCount: params.usage.totalTokenCount,
          createdAt: params.now,
        });
        await transaction.insert(questions).values(
          params.questions.map((question) => ({
            id: question.id,
            publicId: question.publicId,
            recipientProfileId: params.profileId,
            recipientUserId: params.ownerUserId,
            askerUserId: params.ownerUserId,
            askerProfileId: null,
            identityMode: "account_anonymous" as const,
            source: "ai_generated" as const,
            generationBatchId: params.batchId,
            status: "inbox" as const,
            originalText: question.text,
            normalizedTextHash: question.normalizedTextHash,
            ipHash: null,
            userAgentHash: null,
            safetyFingerprintHash: null,
            safetyMetadataRetainUntil: null,
            createdAt: params.now,
            updatedAt: params.now,
          })),
        );
        await transaction.insert(events).values({
          id: createDatabaseId(),
          userId: params.ownerUserId,
          profileId: params.profileId,
          type: "question_generation_batch",
          metadata: {
            batchId: params.batchId,
            language: params.language,
            style: params.style,
            requestedCount: params.requestedCount,
            modelUsed: params.modelUsed,
            promptTokenCount: params.usage.promptTokenCount,
            candidateTokenCount: params.usage.candidateTokenCount,
            totalTokenCount: params.usage.totalTokenCount,
          },
          createdAt: params.now,
        });
      });
    },
  };
}
