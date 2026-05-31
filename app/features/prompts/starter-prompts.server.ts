import type { ZodError } from "zod";
import { z } from "zod";

import { getRuntimeDatabase, type RuntimeDatabase } from "~/db/client.server";
import { questions } from "~/db/schema";
import type { CompletedProfileSessionSummary } from "~/features/auth/auth.server";
import { findStarterPrompt } from "~/features/prompts/starter-prompts";
import { hashWithHmacSha256 } from "~/lib/crypto.server";
import { createDatabaseId, createPublicId } from "~/lib/ids.server";
import { parseFormData } from "~/lib/zod-form";

export interface StarterPromptQuestion {
  id: string;
  publicId: string;
  recipientProfileId: string;
  recipientUserId: string;
  askerUserId: null;
  askerProfileId: null;
  identityMode: "guest_anonymous";
  source: "starter_prompt";
  status: "inbox";
  originalText: string;
  normalizedTextHash: string;
  ipHash: null;
  userAgentHash: null;
  safetyFingerprintHash: string;
  safetyMetadataRetainUntil: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface StarterPromptStore {
  createQuestion(question: StarterPromptQuestion): Promise<void>;
}

export interface StarterPromptFormValues {
  promptId: string;
}

export interface StarterPromptFieldErrors {
  promptId?: string;
}

export type StarterPromptDeniedReason = "suspended";

export type StarterPromptActionResult =
  | {
      status: "created";
      questionPublicId: string;
    }
  | {
      status: "invalid";
      values: StarterPromptFormValues;
      fieldErrors: StarterPromptFieldErrors;
      formError: string;
    }
  | {
      status: "denied";
      values: StarterPromptFormValues;
      reason: StarterPromptDeniedReason;
      formError: string;
    };

const starterPromptFormSchema = z.object({
  promptId: z.string().trim().min(1, "Choose a starter prompt."),
});

export async function createStarterPromptQuestion({
  createId = createDatabaseId,
  createQuestionPublicId = () => createPublicId("qst"),
  formData,
  now = new Date(),
  session,
  store = createDrizzleStarterPromptStore(),
}: {
  formData: FormData;
  session: CompletedProfileSessionSummary;
  store?: StarterPromptStore;
  createId?: () => string;
  createQuestionPublicId?: () => string;
  now?: Date;
}): Promise<StarterPromptActionResult> {
  const values = getStarterPromptFormValues(formData);

  if (session.suspensionStatus === "active") {
    return {
      status: "denied",
      values,
      reason: "suspended",
      formError: "Starter prompts are unavailable while this account is suspended.",
    };
  }

  const parsed = parseFormData(starterPromptFormSchema, formData);

  if (!parsed.ok) {
    return invalidResult(values, parsed.error);
  }

  const prompt = findStarterPrompt(parsed.value.promptId);

  if (prompt === undefined) {
    return {
      status: "invalid",
      values,
      fieldErrors: {
        promptId: "Choose a starter prompt.",
      },
      formError: "Choose a starter prompt and try again.",
    };
  }

  const publicId = createQuestionPublicId();
  const question = createStarterPromptQuestionRow({
    id: createId(),
    now,
    promptText: prompt.text,
    publicId,
    session,
  });

  await store.createQuestion(question);

  return {
    status: "created",
    questionPublicId: publicId,
  };
}

export function createDrizzleStarterPromptStore(
  database: RuntimeDatabase = getRuntimeDatabase(),
): StarterPromptStore {
  return {
    async createQuestion(question) {
      await database.insert(questions).values(question);
    },
  };
}

function createStarterPromptQuestionRow({
  id,
  now,
  promptText,
  publicId,
  session,
}: {
  id: string;
  publicId: string;
  promptText: string;
  session: CompletedProfileSessionSummary;
  now: Date;
}): StarterPromptQuestion {
  return {
    id,
    publicId,
    recipientProfileId: session.profile.id,
    recipientUserId: session.user.id,
    askerUserId: null,
    askerProfileId: null,
    identityMode: "guest_anonymous",
    source: "starter_prompt",
    status: "inbox",
    originalText: promptText,
    normalizedTextHash: hashWithHmacSha256(
      normalizeQuestionTextForHash(promptText),
      "question-text",
    ),
    ipHash: null,
    userAgentHash: null,
    safetyFingerprintHash: hashWithHmacSha256(
      `${session.profile.id}:${publicId}`,
      "starter-prompt-safety",
    ),
    safetyMetadataRetainUntil: addDays(now, 30),
    createdAt: now,
    updatedAt: now,
  };
}

function invalidResult(
  values: StarterPromptFormValues,
  error: ZodError,
): StarterPromptActionResult {
  return {
    status: "invalid",
    values,
    fieldErrors: getStarterPromptFieldErrors(error),
    formError: "Choose a starter prompt and try again.",
  };
}

function getStarterPromptFieldErrors(error: ZodError) {
  const fieldErrors: StarterPromptFieldErrors = {};

  for (const issue of error.issues) {
    if (issue.path[0] === "promptId" && fieldErrors.promptId === undefined) {
      fieldErrors.promptId = issue.message;
    }
  }

  return fieldErrors;
}

function getStarterPromptFormValues(formData: FormData): StarterPromptFormValues {
  return {
    promptId: getFormText(formData, "promptId")?.trim() ?? "",
  };
}

function getFormText(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : undefined;
}

function normalizeQuestionTextForHash(text: string) {
  return text.replaceAll(/\s+/g, " ").trim().toLowerCase();
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}
