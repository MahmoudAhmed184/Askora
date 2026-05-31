import { eq } from "drizzle-orm";
import type { ZodError } from "zod";

import { getRuntimeDatabase, type RuntimeDatabase } from "~/db/client.server";
import { blocks, questions, reports } from "~/db/schema";
import type { CompletedProfileSessionSummary } from "~/features/auth/auth.server";
import {
  inboxActionFormSchema,
  reportReasonValues,
  type InboxActionFormSubmission,
  type InboxActionIntent,
  type ReportReason,
} from "~/features/inbox/inbox.schema";
import { createDatabaseId } from "~/lib/ids.server";
import { parseFormData } from "~/lib/zod-form";

export type InboxActionQuestionStatus =
  | "inbox"
  | "filtered"
  | "draft"
  | "answered";

export type InboxActionQuestionIdentity =
  | "guest_anonymous"
  | "account_anonymous"
  | "account_attributed";

export interface InboxActionQuestion {
  id: string;
  publicId: string;
  recipientProfileId: string;
  recipientUserId: string;
  askerUserId: string | null;
  askerProfileId: string | null;
  identityMode: InboxActionQuestionIdentity;
  status: InboxActionQuestionStatus;
  deletedAt: Date | null;
  safetyFingerprintHash: string;
  ipHash: string | null;
  safetyMetadataRetainUntil: Date;
}

export interface NewQuestionReport {
  id: string;
  reporterUserId: string;
  reporterProfileId: string;
  targetType: "question";
  targetId: string;
  reason: ReportReason;
  details: string | undefined;
  status: "open";
  createdAt: Date;
  updatedAt: Date;
}

export interface NewSenderBlock {
  id: string;
  ownerProfileId: string;
  ownerUserId: string;
  blockedUserId: string | null;
  blockedProfileId: string | null;
  safetyFingerprintHash: string | null;
  ipHash: string | null;
  sourceQuestionId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface InboxActionStore {
  findQuestionForAction(
    publicId: string,
  ): Promise<InboxActionQuestion | undefined>;
  deleteQuestionByRecipient(params: {
    questionId: string;
    deletedAt: Date;
    deletedBy: "recipient";
  }): Promise<void>;
  restoreFilteredQuestion(params: {
    questionId: string;
    updatedAt: Date;
  }): Promise<void>;
  createReport(report: NewQuestionReport): Promise<void>;
  createBlock(block: NewSenderBlock): Promise<"created" | "existing">;
  extendQuestionSafetyMetadataRetention(params: {
    questionId: string;
    retainUntil: Date;
    updatedAt: Date;
  }): Promise<void>;
}

export interface InboxActionFormValues {
  intent: InboxActionIntent | "unknown";
  questionPublicId: string;
  reason: ReportReason | "unknown";
  details: string;
  alsoBlockSender: boolean;
}

export interface InboxActionFieldErrors {
  intent?: string;
  questionPublicId?: string;
  reason?: string;
  details?: string;
  alsoBlockSender?: string;
}

export type InboxActionDeniedReason =
  | "not_found"
  | "suspended"
  | "already_deleted"
  | "closed"
  | "not_filtered"
  | "self_block"
  | "no_blockable_sender";

export type InboxActionResult =
  | {
      status: "deleted" | "restored" | "blocked" | "reported" | "reported_and_blocked";
      questionPublicId: string;
    }
  | {
      status: "invalid";
      values: InboxActionFormValues;
      fieldErrors: InboxActionFieldErrors;
      formError?: string;
    }
  | {
      status: "denied";
      values: InboxActionFormValues;
      reason: InboxActionDeniedReason;
      formError: string;
    };

export const QUESTION_REPORT_RETENTION_DAYS = 180;

export async function handleInboxAction({
  createId = createDatabaseId,
  formData,
  now = new Date(),
  session,
  store = createDrizzleInboxActionStore(),
}: {
  formData: FormData;
  session: CompletedProfileSessionSummary;
  store?: InboxActionStore;
  createId?: () => string;
  now?: Date;
}): Promise<InboxActionResult> {
  const values = getInboxActionFormValues(formData);

  if (session.suspensionStatus === "active") {
    return deniedResult(values, "suspended");
  }

  const parsed = parseFormData(inboxActionFormSchema, formData);

  if (!parsed.ok) {
    return {
      status: "invalid",
      values,
      fieldErrors: getInboxActionFieldErrors(parsed.error),
      formError: "Check the action fields and try again.",
    };
  }

  const question = await findActionableQuestion({
    intent: parsed.value.intent,
    publicId: parsed.value.questionPublicId,
    session,
    store,
  });

  if (question.status === "denied") {
    return deniedResult(values, question.reason);
  }

  return executeInboxAction({
    createId,
    form: parsed.value,
    now,
    question: question.question,
    session,
    store,
    values,
  });
}

export function createDrizzleInboxActionStore(
  database: RuntimeDatabase = getRuntimeDatabase(),
): InboxActionStore {
  return {
    async findQuestionForAction(publicId) {
      const [question] = await database
        .select({
          id: questions.id,
          publicId: questions.publicId,
          recipientProfileId: questions.recipientProfileId,
          recipientUserId: questions.recipientUserId,
          askerUserId: questions.askerUserId,
          askerProfileId: questions.askerProfileId,
          identityMode: questions.identityMode,
          status: questions.status,
          deletedAt: questions.deletedAt,
          safetyFingerprintHash: questions.safetyFingerprintHash,
          ipHash: questions.ipHash,
          safetyMetadataRetainUntil: questions.safetyMetadataRetainUntil,
        })
        .from(questions)
        .where(eq(questions.publicId, publicId))
        .limit(1);

      return question;
    },
    async deleteQuestionByRecipient({ deletedAt, questionId }) {
      await database
        .update(questions)
        .set({
          deletedAt,
          deletedBy: "recipient",
          updatedAt: deletedAt,
        })
        .where(eq(questions.id, questionId));
    },
    async restoreFilteredQuestion({ questionId, updatedAt }) {
      await database
        .update(questions)
        .set({
          status: "inbox",
          updatedAt,
        })
        .where(eq(questions.id, questionId));
    },
    async createReport(report) {
      await database.insert(reports).values(report);
    },
    async createBlock(block) {
      await database.insert(blocks).values(block).onConflictDoNothing();
      return "created";
    },
    async extendQuestionSafetyMetadataRetention({
      questionId,
      retainUntil,
      updatedAt,
    }) {
      await database
        .update(questions)
        .set({
          safetyMetadataRetainUntil: retainUntil,
          updatedAt,
        })
        .where(eq(questions.id, questionId));
    },
  };
}

async function executeInboxAction({
  createId,
  form,
  now,
  question,
  session,
  store,
  values,
}: {
  createId: () => string;
  form: InboxActionFormSubmission;
  now: Date;
  question: InboxActionQuestion;
  session: CompletedProfileSessionSummary;
  store: InboxActionStore;
  values: InboxActionFormValues;
}): Promise<InboxActionResult> {
  if (form.intent === "delete") {
    await store.deleteQuestionByRecipient({
      questionId: question.id,
      deletedAt: now,
      deletedBy: "recipient",
    });

    return {
      status: "deleted",
      questionPublicId: question.publicId,
    };
  }

  if (form.intent === "restore") {
    if (question.status !== "filtered") {
      return deniedResult(values, "not_filtered");
    }

    await store.restoreFilteredQuestion({
      questionId: question.id,
      updatedAt: now,
    });

    return {
      status: "restored",
      questionPublicId: question.publicId,
    };
  }

  if (form.intent === "block") {
    const block = createSenderBlock({
      createId,
      now,
      question,
      session,
    });

    if (block.status === "denied") {
      return deniedResult(values, block.reason);
    }

    await store.createBlock(block.block);
    await retainQuestionSafetyMetadata({ now, question, store });

    return {
      status: "blocked",
      questionPublicId: question.publicId,
    };
  }

  const report = createQuestionReport({
    createId,
    form,
    now,
    question,
    session,
  });

  await store.createReport(report);
  await retainQuestionSafetyMetadata({ now, question, store });

  if (!form.alsoBlockSender) {
    return {
      status: "reported",
      questionPublicId: question.publicId,
    };
  }

  const block = createSenderBlock({
    createId,
    now,
    question,
    session,
  });

  if (block.status === "denied") {
    return {
      status: "reported",
      questionPublicId: question.publicId,
    };
  }

  await store.createBlock(block.block);

  return {
    status: "reported_and_blocked",
    questionPublicId: question.publicId,
  };
}

async function findActionableQuestion({
  intent,
  publicId,
  session,
  store,
}: {
  intent: InboxActionIntent;
  publicId: string;
  session: CompletedProfileSessionSummary;
  store: InboxActionStore;
}): Promise<
  | {
      status: "allowed";
      question: InboxActionQuestion;
    }
  | {
      status: "denied";
      reason: InboxActionDeniedReason;
    }
> {
  const question = await store.findQuestionForAction(publicId);

  if (
    question?.recipientProfileId !== session.profile.id ||
    question.recipientUserId !== session.user.id
  ) {
    return { status: "denied", reason: "not_found" };
  }

  if (question.deletedAt !== null) {
    return { status: "denied", reason: "already_deleted" };
  }

  if (!isPrivateQuestionActionStatus({ intent, status: question.status })) {
    return { status: "denied", reason: "closed" };
  }

  return {
    status: "allowed",
    question,
  };
}

function createQuestionReport({
  createId,
  form,
  now,
  question,
  session,
}: {
  createId: () => string;
  form: Extract<InboxActionFormSubmission, { intent: "report" }>;
  now: Date;
  question: InboxActionQuestion;
  session: CompletedProfileSessionSummary;
}): NewQuestionReport {
  return {
    id: createId(),
    reporterUserId: session.user.id,
    reporterProfileId: session.profile.id,
    targetType: "question",
    targetId: question.id,
    reason: form.reason,
    details: form.details,
    status: "open",
    createdAt: now,
    updatedAt: now,
  };
}

function createSenderBlock({
  createId,
  now,
  question,
  session,
}: {
  createId: () => string;
  now: Date;
  question: InboxActionQuestion;
  session: CompletedProfileSessionSummary;
}):
  | {
      status: "blockable";
      block: NewSenderBlock;
    }
  | {
      status: "denied";
      reason: Extract<InboxActionDeniedReason, "self_block" | "no_blockable_sender">;
    } {
  if (
    question.askerUserId === session.user.id ||
    question.askerProfileId === session.profile.id
  ) {
    return {
      status: "denied",
      reason: "self_block",
    };
  }

  if (question.askerUserId !== null) {
    return {
      status: "blockable",
      block: {
        id: createId(),
        ownerProfileId: session.profile.id,
        ownerUserId: session.user.id,
        blockedUserId: question.askerUserId,
        blockedProfileId: question.askerProfileId,
        safetyFingerprintHash: null,
        ipHash: null,
        sourceQuestionId: question.id,
        createdAt: now,
        updatedAt: now,
      },
    };
  }

  if (question.safetyFingerprintHash.trim().length === 0) {
    return {
      status: "denied",
      reason: "no_blockable_sender",
    };
  }

  return {
    status: "blockable",
    block: {
      id: createId(),
      ownerProfileId: session.profile.id,
      ownerUserId: session.user.id,
      blockedUserId: null,
      blockedProfileId: null,
      safetyFingerprintHash: question.safetyFingerprintHash,
      ipHash: question.ipHash,
      sourceQuestionId: question.id,
      createdAt: now,
      updatedAt: now,
    },
  };
}

async function retainQuestionSafetyMetadata({
  now,
  question,
  store,
}: {
  now: Date;
  question: InboxActionQuestion;
  store: InboxActionStore;
}) {
  await store.extendQuestionSafetyMetadataRetention({
    questionId: question.id,
    retainUntil: maxDate(
      question.safetyMetadataRetainUntil,
      addDays(now, QUESTION_REPORT_RETENTION_DAYS),
    ),
    updatedAt: now,
  });
}

function deniedResult(
  values: InboxActionFormValues,
  reason: InboxActionDeniedReason,
): InboxActionResult {
  return {
    status: "denied",
    values,
    reason,
    formError: getDeniedMessage(reason),
  };
}

function getInboxActionFormValues(formData: FormData): InboxActionFormValues {
  const intent = getFormText(formData, "intent");
  const reason = getFormText(formData, "reason");

  return {
    intent: isInboxActionIntent(intent) ? intent : "unknown",
    questionPublicId: getFormText(formData, "questionPublicId")?.trim() ?? "",
    reason: isReportReason(reason) ? reason : "unknown",
    details: getFormText(formData, "details")?.trim() ?? "",
    alsoBlockSender: hasCheckedValue(formData, "alsoBlockSender"),
  };
}

function getInboxActionFieldErrors(error: ZodError): InboxActionFieldErrors {
  const fieldErrors: InboxActionFieldErrors = {};

  for (const issue of error.issues) {
    const field = issue.path[0];

    if (field === "intent" && fieldErrors.intent === undefined) {
      fieldErrors.intent = issue.message;
    }

    if (
      field === "questionPublicId" &&
      fieldErrors.questionPublicId === undefined
    ) {
      fieldErrors.questionPublicId = issue.message;
    }

    if (field === "reason" && fieldErrors.reason === undefined) {
      fieldErrors.reason = issue.message;
    }

    if (field === "details" && fieldErrors.details === undefined) {
      fieldErrors.details = issue.message;
    }

    if (
      field === "alsoBlockSender" &&
      fieldErrors.alsoBlockSender === undefined
    ) {
      fieldErrors.alsoBlockSender = issue.message;
    }
  }

  return fieldErrors;
}

function getDeniedMessage(reason: InboxActionDeniedReason) {
  switch (reason) {
    case "not_found":
      return "Question could not be found.";
    case "suspended":
      return "Inbox actions are unavailable while this account is suspended.";
    case "already_deleted":
      return "Question has already been deleted.";
    case "closed":
      return "This question is no longer available for inbox actions.";
    case "not_filtered":
      return "Only filtered questions can be restored.";
    case "self_block":
      return "You cannot block your own sender identity.";
    case "no_blockable_sender":
      return "This sender cannot be blocked from this question.";
  }
}

function isPrivateQuestionActionStatus({
  intent,
  status,
}: {
  intent: InboxActionIntent;
  status: InboxActionQuestionStatus;
}) {
  if (status === "inbox" || status === "filtered") {
    return true;
  }

  return status === "draft" && (intent === "report" || intent === "block");
}

function isInboxActionIntent(
  value: string | undefined,
): value is InboxActionIntent {
  return (
    value === "delete" ||
    value === "restore" ||
    value === "report" ||
    value === "block"
  );
}

function isReportReason(value: string | undefined): value is ReportReason {
  return reportReasonValues.includes(value as ReportReason);
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

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function maxDate(left: Date, right: Date) {
  return left.getTime() >= right.getTime() ? left : right;
}
