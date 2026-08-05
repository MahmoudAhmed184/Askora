import { eq } from "drizzle-orm";

import { getRuntimeDatabase, type RuntimeDatabase } from "~/db/client.server";
import { events, questionGenerationSettings } from "~/db/schema";
import type { QuestionGenerationModelPreference } from "~/features/question-generation/question-generation.constants";
import type { StoredQuestionGenerationCredential } from "~/features/question-generation/question-generation.crypto.server";
import { createDatabaseId } from "~/lib/ids.server";

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
