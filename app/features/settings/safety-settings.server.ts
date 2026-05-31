import { and, desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { ZodError } from "zod";
import { z } from "zod";

import { getRuntimeDatabase, type RuntimeDatabase } from "~/db/client.server";
import { blocks, mutedPhrases, profiles } from "~/db/schema";
import type { CompletedProfileSessionSummary } from "~/features/auth/auth.server";
import {
  checkboxBooleanSchema,
  mutedPhraseSubmissionSchema,
  type MutedPhraseSubmission,
} from "~/features/moderation/moderation.schema";
import { createDatabaseId } from "~/lib/ids.server";
import { parseFormData } from "~/lib/zod-form";

export const MAX_MUTED_PHRASES_PER_PROFILE = 50;

export const safetySettingsIntentValues = [
  "update_safety",
  "add_muted_phrase",
  "remove_muted_phrase",
  "unblock_sender",
] as const;

export type SafetySettingsIntent = (typeof safetySettingsIntentValues)[number];

export interface SafetySettingsFormValues {
  intent: SafetySettingsIntent | "unknown";
  acceptingQuestions: boolean;
  phrase: string;
  mutedPhraseId: string;
  blockId: string;
}

export interface SafetySettingsFieldErrors {
  intent?: string;
  acceptingQuestions?: string;
  phrase?: string;
  mutedPhraseId?: string;
  blockId?: string;
}

export type SafetySettingsSubmissionResult =
  | {
      status: "safety_updated";
      values: SafetySettingsFormValues;
    }
  | {
      status: "muted_phrase_added";
      values: SafetySettingsFormValues;
    }
  | {
      status: "muted_phrase_duplicate" | "muted_phrase_limit";
      values: SafetySettingsFormValues;
      fieldErrors: Required<Pick<SafetySettingsFieldErrors, "phrase">>;
      formError: string;
    }
  | {
      status: "muted_phrase_removed" | "sender_unblocked";
      values: SafetySettingsFormValues;
    }
  | {
      status: "invalid";
      values: SafetySettingsFormValues;
      fieldErrors: SafetySettingsFieldErrors;
      formError: string;
    }
  | {
      status: "suspended" | "not_found";
      values: SafetySettingsFormValues;
      formError: string;
    };

export interface SafetyMutedPhraseView {
  id: string;
  phrase: string;
  createdAt: string;
}

export type SafetyBlockView =
  | {
      id: string;
      type: "account";
      createdAt: string;
      profile:
        | {
            displayName: string;
            username: string;
          }
        | undefined;
    }
  | {
      id: string;
      type: "account_anonymous" | "anonymous_signal";
      createdAt: string;
    };

export interface SafetySettingsViewData {
  acceptingQuestions: boolean;
  mutedPhrases: SafetyMutedPhraseView[];
  blocks: SafetyBlockView[];
}

export interface StoredSafetyMutedPhrase {
  id: string;
  phrase: string;
  normalizedPhrase: string;
  createdAt: Date;
}

export interface StoredSafetyBlock {
  id: string;
  blockedUserId: string | null;
  blockedProfileId: string | null;
  blockedProfile:
    | {
        displayName: string;
        username: string;
      }
    | undefined;
  createdAt: Date;
}

export interface StoredSafetySettings {
  acceptingQuestions: boolean;
  mutedPhrases: StoredSafetyMutedPhrase[];
  blocks: StoredSafetyBlock[];
}

export interface AcceptingQuestionsUpdate {
  profileId: string;
  userId: string;
  acceptingQuestions: boolean;
  updatedAt: Date;
}

export interface NewMutedPhrase {
  id: string;
  profileId: string;
  phrase: string;
  normalizedPhrase: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SafetySettingsStore {
  findSafetySettings(params: {
    profileId: string;
    userId: string;
  }): Promise<StoredSafetySettings | undefined>;
  updateAcceptingQuestions(update: AcceptingQuestionsUpdate): Promise<void>;
  createMutedPhrase(phrase: NewMutedPhrase): Promise<"created" | "existing">;
  deleteMutedPhrase(params: {
    profileId: string;
    mutedPhraseId: string;
  }): Promise<void>;
  deleteBlock(params: {
    ownerProfileId: string;
    ownerUserId: string;
    blockId: string;
  }): Promise<void>;
}

interface LoadSafetySettingsOptions {
  session: CompletedProfileSessionSummary;
  store?: SafetySettingsStore;
}

interface SubmitSafetySettingsOptions extends LoadSafetySettingsOptions {
  formData: FormData;
  createId?: () => string;
  now?: Date;
}

const suspendedSafetySettingsMessage =
  "Safety settings are unavailable while this account is suspended.";
const safetySettingsNotFoundMessage =
  "Your safety settings could not be loaded.";
const mutedPhraseDuplicateMessage = "This phrase is already muted.";
const mutedPhraseLimitMessage = "You can mute up to 50 phrases.";

const acceptingQuestionsSubmissionSchema = z.object({
  acceptingQuestions: checkboxBooleanSchema,
});
const mutedPhraseIdSubmissionSchema = z.object({
  mutedPhraseId: z.string().trim().min(1, "Choose a muted phrase."),
});
const blockIdSubmissionSchema = z.object({
  blockId: z.string().trim().min(1, "Choose a blocked sender."),
});

export async function loadSafetySettings({
  session,
  store = createDrizzleSafetySettingsStore(),
}: LoadSafetySettingsOptions): Promise<SafetySettingsViewData> {
  const settings = await store.findSafetySettings({
    profileId: session.profile.id,
    userId: session.user.id,
  });

  if (settings === undefined) {
    throw new Error(safetySettingsNotFoundMessage);
  }

  return toSafetySettingsViewData(settings);
}

export async function submitSafetySettings({
  createId = createDatabaseId,
  formData,
  session,
  store = createDrizzleSafetySettingsStore(),
  now = new Date(),
}: SubmitSafetySettingsOptions): Promise<SafetySettingsSubmissionResult> {
  const values = getSafetySettingsFormValues(formData);

  if (session.suspensionStatus === "active") {
    return {
      status: "suspended",
      values,
      formError: suspendedSafetySettingsMessage,
    };
  }

  if (values.intent === "unknown") {
    return invalidResult(values, { intent: "Choose a safety action." });
  }

  return submitKnownSafetyAction({
    createId,
    formData,
    now,
    session,
    store,
    values: {
      ...values,
      intent: values.intent,
    },
  });
}

export function createDrizzleSafetySettingsStore(
  database: RuntimeDatabase = getRuntimeDatabase(),
): SafetySettingsStore {
  return {
    async findSafetySettings({ profileId, userId }) {
      const [profile] = await database
        .select({
          acceptingQuestions: profiles.acceptingQuestions,
        })
        .from(profiles)
        .where(and(eq(profiles.id, profileId), eq(profiles.userId, userId)))
        .limit(1);

      if (profile === undefined) {
        return undefined;
      }

      const [mutedPhraseRows, blockRows] = await Promise.all([
        database
          .select({
            id: mutedPhrases.id,
            phrase: mutedPhrases.phrase,
            normalizedPhrase: mutedPhrases.normalizedPhrase,
            createdAt: mutedPhrases.createdAt,
          })
          .from(mutedPhrases)
          .where(eq(mutedPhrases.profileId, profileId))
          .orderBy(desc(mutedPhrases.createdAt)),
        findSafetyBlockRows({ database, profileId, userId }),
      ]);

      return {
        acceptingQuestions: profile.acceptingQuestions,
        mutedPhrases: mutedPhraseRows,
        blocks: blockRows,
      };
    },
    async updateAcceptingQuestions(update) {
      await database
        .update(profiles)
        .set({
          acceptingQuestions: update.acceptingQuestions,
          updatedAt: update.updatedAt,
        })
        .where(
          and(eq(profiles.id, update.profileId), eq(profiles.userId, update.userId)),
        );
    },
    async createMutedPhrase(phrase) {
      const [inserted] = await database
        .insert(mutedPhrases)
        .values(phrase)
        .onConflictDoNothing()
        .returning({ id: mutedPhrases.id });

      return inserted === undefined ? "existing" : "created";
    },
    async deleteMutedPhrase({ mutedPhraseId, profileId }) {
      await database
        .delete(mutedPhrases)
        .where(
          and(eq(mutedPhrases.id, mutedPhraseId), eq(mutedPhrases.profileId, profileId)),
        );
    },
    async deleteBlock({ blockId, ownerProfileId, ownerUserId }) {
      await database
        .delete(blocks)
        .where(
          and(
            eq(blocks.id, blockId),
            eq(blocks.ownerProfileId, ownerProfileId),
            eq(blocks.ownerUserId, ownerUserId),
          ),
        );
    },
  };
}

async function submitKnownSafetyAction({
  createId,
  formData,
  now,
  session,
  store,
  values,
}: {
  createId: () => string;
  formData: FormData;
  now: Date;
  session: CompletedProfileSessionSummary;
  store: SafetySettingsStore;
  values: SafetySettingsFormValues & { intent: SafetySettingsIntent };
}): Promise<SafetySettingsSubmissionResult> {
  if (values.intent === "update_safety") {
    const parsed = parseFormData(acceptingQuestionsSubmissionSchema, formData);

    if (!parsed.ok) {
      return invalidResult(values, getSafetySettingsFieldErrors(parsed.error));
    }

    if ((await findSettingsForAction({ session, store })) === undefined) {
      return notFoundResult(values);
    }

    await store.updateAcceptingQuestions({
      profileId: session.profile.id,
      userId: session.user.id,
      acceptingQuestions: parsed.value.acceptingQuestions,
      updatedAt: now,
    });

    return {
      status: "safety_updated",
      values: {
        ...values,
        acceptingQuestions: parsed.value.acceptingQuestions,
      },
    };
  }

  if (values.intent === "add_muted_phrase") {
    const parsed = parseFormData(mutedPhraseSubmissionSchema, formData);

    if (!parsed.ok) {
      return invalidResult(values, getSafetySettingsFieldErrors(parsed.error));
    }

    const settings = await findSettingsForAction({ session, store });

    if (settings === undefined) {
      return notFoundResult(values);
    }

    return addMutedPhrase({
      createId,
      mutedPhrase: parsed.value,
      now,
      session,
      settings,
      store,
      values,
    });
  }

  if (values.intent === "remove_muted_phrase") {
    const parsed = parseFormData(mutedPhraseIdSubmissionSchema, formData);

    if (!parsed.ok) {
      return invalidResult(values, getSafetySettingsFieldErrors(parsed.error));
    }

    if ((await findSettingsForAction({ session, store })) === undefined) {
      return notFoundResult(values);
    }

    await store.deleteMutedPhrase({
      profileId: session.profile.id,
      mutedPhraseId: parsed.value.mutedPhraseId,
    });

    return {
      status: "muted_phrase_removed",
      values: {
        ...values,
        mutedPhraseId: parsed.value.mutedPhraseId,
      },
    };
  }

  const parsed = parseFormData(blockIdSubmissionSchema, formData);

  if (!parsed.ok) {
    return invalidResult(values, getSafetySettingsFieldErrors(parsed.error));
  }

  if ((await findSettingsForAction({ session, store })) === undefined) {
    return notFoundResult(values);
  }

  await store.deleteBlock({
    ownerProfileId: session.profile.id,
    ownerUserId: session.user.id,
    blockId: parsed.value.blockId,
  });

  return {
    status: "sender_unblocked",
    values: {
      ...values,
      blockId: parsed.value.blockId,
    },
  };
}

async function findSettingsForAction({
  session,
  store,
}: {
  session: CompletedProfileSessionSummary;
  store: SafetySettingsStore;
}) {
  return store.findSafetySettings({
    profileId: session.profile.id,
    userId: session.user.id,
  });
}

function notFoundResult(
  values: SafetySettingsFormValues,
): SafetySettingsSubmissionResult {
  return {
    status: "not_found",
    values,
    formError: safetySettingsNotFoundMessage,
  };
}

async function addMutedPhrase({
  createId,
  mutedPhrase,
  now,
  session,
  settings,
  store,
  values,
}: {
  createId: () => string;
  mutedPhrase: MutedPhraseSubmission;
  now: Date;
  session: CompletedProfileSessionSummary;
  settings: StoredSafetySettings;
  store: SafetySettingsStore;
  values: SafetySettingsFormValues;
}): Promise<SafetySettingsSubmissionResult> {
  const duplicate = settings.mutedPhrases.some(
    (phrase) => phrase.normalizedPhrase === mutedPhrase.normalizedPhrase,
  );

  if (duplicate) {
    return mutedPhraseDuplicateResult(values);
  }

  if (settings.mutedPhrases.length >= MAX_MUTED_PHRASES_PER_PROFILE) {
    return {
      status: "muted_phrase_limit",
      values,
      fieldErrors: { phrase: mutedPhraseLimitMessage },
      formError: mutedPhraseLimitMessage,
    };
  }

  const created = await store.createMutedPhrase({
    id: createId(),
    profileId: session.profile.id,
    phrase: mutedPhrase.phrase,
    normalizedPhrase: mutedPhrase.normalizedPhrase,
    createdAt: now,
    updatedAt: now,
  });

  if (created === "existing") {
    return mutedPhraseDuplicateResult(values);
  }

  return {
    status: "muted_phrase_added",
    values: {
      ...values,
      phrase: mutedPhrase.phrase,
    },
  };
}

function mutedPhraseDuplicateResult(
  values: SafetySettingsFormValues,
): SafetySettingsSubmissionResult {
  return {
    status: "muted_phrase_duplicate",
    values,
    fieldErrors: { phrase: mutedPhraseDuplicateMessage },
    formError: mutedPhraseDuplicateMessage,
  };
}

function invalidResult(
  values: SafetySettingsFormValues,
  fieldErrors: SafetySettingsFieldErrors,
): SafetySettingsSubmissionResult {
  return {
    status: "invalid",
    values,
    fieldErrors,
    formError: "Check the safety settings and try again.",
  };
}

function getSafetySettingsFormValues(
  formData: FormData,
): SafetySettingsFormValues {
  const intent = getFormText(formData, "intent");

  return {
    intent: isSafetySettingsIntent(intent) ? intent : "unknown",
    acceptingQuestions: hasCheckedValue(formData, "acceptingQuestions"),
    phrase: getFormText(formData, "phrase")?.trim() ?? "",
    mutedPhraseId: getFormText(formData, "mutedPhraseId")?.trim() ?? "",
    blockId: getFormText(formData, "blockId")?.trim() ?? "",
  };
}

function getSafetySettingsFieldErrors(
  error: ZodError,
): SafetySettingsFieldErrors {
  const fieldErrors: SafetySettingsFieldErrors = {};

  for (const issue of error.issues) {
    const field = issue.path[0];

    if (
      field === "acceptingQuestions" &&
      fieldErrors.acceptingQuestions === undefined
    ) {
      fieldErrors.acceptingQuestions = issue.message;
    }

    if (field === "phrase" && fieldErrors.phrase === undefined) {
      fieldErrors.phrase = issue.message;
    }

    if (field === "mutedPhraseId" && fieldErrors.mutedPhraseId === undefined) {
      fieldErrors.mutedPhraseId = issue.message;
    }

    if (field === "blockId" && fieldErrors.blockId === undefined) {
      fieldErrors.blockId = issue.message;
    }
  }

  return fieldErrors;
}

function toSafetySettingsViewData(
  settings: StoredSafetySettings,
): SafetySettingsViewData {
  return {
    acceptingQuestions: settings.acceptingQuestions,
    mutedPhrases: settings.mutedPhrases.map((phrase) => ({
      id: phrase.id,
      phrase: phrase.phrase,
      createdAt: phrase.createdAt.toISOString(),
    })),
    blocks: settings.blocks.map(toSafetyBlockView),
  };
}

function toSafetyBlockView(block: StoredSafetyBlock): SafetyBlockView {
  if (block.blockedProfileId !== null) {
    return {
      id: block.id,
      type: "account",
      profile: block.blockedProfile,
      createdAt: block.createdAt.toISOString(),
    };
  }

  if (block.blockedUserId !== null) {
    return {
      id: block.id,
      type: "account_anonymous",
      createdAt: block.createdAt.toISOString(),
    };
  }

  return {
    id: block.id,
    type: "anonymous_signal",
    createdAt: block.createdAt.toISOString(),
  };
}

function isSafetySettingsIntent(
  value: string | undefined,
): value is SafetySettingsIntent {
  return safetySettingsIntentValues.includes(value as SafetySettingsIntent);
}

function hasCheckedValue(formData: FormData, key: string) {
  const value = formData.get(key);

  return (
    typeof value === "string" &&
    ["1", "true", "on", "yes"].includes(value.toLowerCase())
  );
}

function getFormText(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : undefined;
}

async function findSafetyBlockRows({
  database,
  profileId,
  userId,
}: {
  database: RuntimeDatabase;
  profileId: string;
  userId: string;
}): Promise<StoredSafetyBlock[]> {
  const blockedProfiles = alias(profiles, "safety_blocked_profiles");
  const rows = await database
    .select({
      id: blocks.id,
      blockedUserId: blocks.blockedUserId,
      blockedProfileId: blocks.blockedProfileId,
      blockedDisplayName: blockedProfiles.displayName,
      blockedUsername: blockedProfiles.username,
      createdAt: blocks.createdAt,
    })
    .from(blocks)
    .leftJoin(blockedProfiles, eq(blockedProfiles.id, blocks.blockedProfileId))
    .where(and(eq(blocks.ownerProfileId, profileId), eq(blocks.ownerUserId, userId)))
    .orderBy(desc(blocks.createdAt));

  return rows.map((row) => ({
    id: row.id,
    blockedUserId: row.blockedUserId,
    blockedProfileId: row.blockedProfileId,
    blockedProfile:
      row.blockedDisplayName === null || row.blockedUsername === null
        ? undefined
        : {
            displayName: row.blockedDisplayName,
            username: row.blockedUsername,
          },
    createdAt: row.createdAt,
  }));
}
