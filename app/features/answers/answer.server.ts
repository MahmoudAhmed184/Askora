import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { ZodError } from "zod";

import { getRuntimeDatabase, type RuntimeDatabase } from "~/db/client.server";
import {
  notifications,
  pinnedAnswers,
  profiles,
  questions,
  threadItems,
  threads,
} from "~/db/schema";
import {
  answerSubmissionSchema,
  answerIntentValues,
  type AnswerFollowUpPermissionOverride,
  type AnswerIntent,
  type AnswerSubmission,
  type QuestionTextMode,
} from "~/features/answers/answer.schema";
import type { CompletedProfileSessionSummary } from "~/features/auth/auth.server";
import type { FollowUpPermission } from "~/features/settings/settings.schema";
import { createDatabaseId, createPublicId } from "~/lib/ids.server";
import { parseFormData } from "~/lib/zod-form";

export type AnswerQuestionStatus =
  | "inbox"
  | "filtered"
  | "draft"
  | "answered";

export type AnswerQuestionIdentity =
  | "guest_anonymous"
  | "account_anonymous"
  | "account_attributed";

export interface AnswerWorkflowQuestion {
  id: string;
  publicId: string;
  recipientProfileId: string;
  recipientUserId: string;
  askerUserId: string | null;
  askerProfileId: string | null;
  identityMode: AnswerQuestionIdentity;
  status: AnswerQuestionStatus;
  originalText: string;
  deletedAt: Date | null;
  createdAt: Date;
  threadId: string | null;
  followUpPermissionDefault: FollowUpPermission;
}

export interface StoredAnswerDraftItem {
  id: string;
  answerText: string;
  displayQuestionText: string | null;
  questionTextMode: QuestionTextMode;
  followUpPermissionOverride: AnswerFollowUpPermissionOverride;
  updatedAt: Date;
}

export interface StoredDraftAnswerQuestion {
  questionId: string;
  questionPublicId: string;
  recipientProfileId: string;
  recipientUserId: string;
  questionText: string;
  answerText: string;
  itemUpdatedAt: Date;
  questionCreatedAt: Date;
  deletedAt: Date | null;
  status: AnswerQuestionStatus;
}

export interface AnswerMutationParams {
  question: AnswerWorkflowQuestion;
  submission: AnswerSubmission;
  now: Date;
  actorUserId: string;
  createDatabaseId: () => string;
  createThreadPublicId: () => string;
  createThreadItemPublicId: () => string;
}

export interface AnswerPublishResult {
  notified: boolean;
}

export interface AnswerStore {
  findQuestionForAnswer(
    publicId: string,
  ): Promise<AnswerWorkflowQuestion | undefined>;
  findDraftItemByQuestionId(
    questionId: string,
  ): Promise<StoredAnswerDraftItem | undefined>;
  findDraftAnswerQuestionsForOwner(params: {
    profileId: string;
    userId: string;
  }): Promise<StoredDraftAnswerQuestion[]>;
  saveDraftAnswer(params: AnswerMutationParams): Promise<void>;
  publishAnswer(params: AnswerMutationParams): Promise<AnswerPublishResult>;
}

export interface AnswerEditorViewData {
  profile: {
    username: string;
    displayName: string;
  };
  question: {
    publicId: string;
    text: string;
    identity: "anonymous" | "attributed";
    createdAt: string;
  };
  values: AnswerFormValues;
  followUpPermissionDefault: FollowUpPermission;
}

export interface DraftAnswerView {
  questionPublicId: string;
  questionText: string;
  answerPreview: string;
  updatedAt: string;
  questionCreatedAt: string;
}

export interface DraftAnswersViewData {
  profile: {
    username: string;
    displayName: string;
  };
  drafts: DraftAnswerView[];
}

export interface AnswerFormValues {
  intent: AnswerIntent | "unknown";
  answerText: string;
  questionTextMode: QuestionTextMode | "unknown";
  editedQuestionText: string;
  followUpPermissionOverride: AnswerFollowUpPermissionOverride | "unknown";
}

export interface AnswerFieldErrors {
  intent?: string;
  answerText?: string;
  questionTextMode?: string;
  editedQuestionText?: string;
  followUpPermissionOverride?: string;
}

export type AnswerDeniedReason = "not_found" | "closed" | "suspended";

export type AnswerEditorLoadResult =
  | {
      status: "found";
      editor: AnswerEditorViewData;
    }
  | {
      status: "not_found";
    };

export type AnswerActionResult =
  | {
      status: "draft_saved";
      questionPublicId: string;
    }
  | {
      status: "published";
      questionPublicId: string;
      redirectTo: string;
      notified: boolean;
    }
  | {
      status: "invalid";
      values: AnswerFormValues;
      fieldErrors: AnswerFieldErrors;
      formError: string;
    }
  | {
      status: "denied";
      values: AnswerFormValues;
      reason: AnswerDeniedReason;
      formError: string;
    };

interface ExistingThread {
  id: string;
  publicId: string;
  status: "draft" | "published" | "unpublished" | "deleted";
  publishedAt: Date | null;
}

interface ExistingThreadItem {
  id: string;
  publicId: string;
  status: "draft" | "published" | "unpublished" | "deleted";
  publishedAt: Date | null;
}

export async function loadAnswerEditor({
  questionPublicId,
  session,
  store = createDrizzleAnswerStore(),
}: {
  questionPublicId: string;
  session: CompletedProfileSessionSummary;
  store?: AnswerStore;
}): Promise<AnswerEditorLoadResult> {
  const question = await findEditableQuestion({
    publicId: questionPublicId,
    session,
    store,
  });

  if (question.status !== "allowed") {
    return { status: "not_found" };
  }

  const draft = await store.findDraftItemByQuestionId(question.question.id);

  return {
    status: "found",
    editor: {
      profile: {
        username: session.profile.username,
        displayName: session.profile.displayName,
      },
      question: {
        publicId: question.question.publicId,
        text: question.question.originalText,
        identity:
          question.question.identityMode === "account_attributed"
            ? "attributed"
            : "anonymous",
        createdAt: question.question.createdAt.toISOString(),
      },
      values: toAnswerFormValues(draft),
      followUpPermissionDefault: question.question.followUpPermissionDefault,
    },
  };
}

export async function loadDraftAnswers({
  session,
  store = createDrizzleAnswerStore(),
}: {
  session: CompletedProfileSessionSummary;
  store?: AnswerStore;
}): Promise<DraftAnswersViewData> {
  const draftRows = await store.findDraftAnswerQuestionsForOwner({
    profileId: session.profile.id,
    userId: session.user.id,
  });

  const drafts = draftRows
    .filter(
      (draft) =>
        draft.recipientProfileId === session.profile.id &&
        draft.recipientUserId === session.user.id &&
        draft.deletedAt === null &&
        draft.status === "draft",
    )
    .sort(
      (left, right) =>
        right.itemUpdatedAt.getTime() - left.itemUpdatedAt.getTime(),
    )
    .map((draft) => ({
      questionPublicId: draft.questionPublicId,
      questionText: draft.questionText,
      answerPreview: createAnswerPreview(draft.answerText),
      updatedAt: draft.itemUpdatedAt.toISOString(),
      questionCreatedAt: draft.questionCreatedAt.toISOString(),
    }));

  return {
    profile: {
      username: session.profile.username,
      displayName: session.profile.displayName,
    },
    drafts,
  };
}

export async function handleAnswerSubmission({
  createId = createDatabaseId,
  createThreadItemPublicId = () => createPublicId("titem"),
  createThreadPublicId = () => createPublicId("thr"),
  formData,
  now = new Date(),
  questionPublicId,
  session,
  store = createDrizzleAnswerStore(),
}: {
  formData: FormData;
  questionPublicId: string;
  session: CompletedProfileSessionSummary;
  store?: AnswerStore;
  createId?: () => string;
  createThreadPublicId?: () => string;
  createThreadItemPublicId?: () => string;
  now?: Date;
}): Promise<AnswerActionResult> {
  const values = getAnswerFormValues(formData);

  if (session.suspensionStatus === "active") {
    return deniedResult(values, "suspended");
  }

  const parsed = parseFormData(answerSubmissionSchema, formData);

  if (!parsed.ok) {
    return {
      status: "invalid",
      values,
      fieldErrors: getAnswerFieldErrors(parsed.error),
      formError: "Check the answer fields and try again.",
    };
  }

  const question = await findEditableQuestion({
    publicId: questionPublicId,
    session,
    store,
  });

  if (question.status === "denied") {
    return deniedResult(values, question.reason);
  }

  const mutationParams = {
    question: question.question,
    submission: parsed.value,
    now,
    actorUserId: session.user.id,
    createDatabaseId: createId,
    createThreadPublicId,
    createThreadItemPublicId,
  } satisfies AnswerMutationParams;

  if (parsed.value.intent === "save_draft") {
    await store.saveDraftAnswer(mutationParams);

    return {
      status: "draft_saved",
      questionPublicId,
    };
  }

  const publish = await store.publishAnswer(mutationParams);

  return {
    status: "published",
    questionPublicId,
    redirectTo: `/${session.profile.username}#published-answers`,
    notified: publish.notified,
  };
}

export function createDrizzleAnswerStore(
  database: RuntimeDatabase = getRuntimeDatabase(),
): AnswerStore {
  return {
    async findQuestionForAnswer(publicId) {
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
          originalText: questions.originalText,
          deletedAt: questions.deletedAt,
          createdAt: questions.createdAt,
          threadId: questions.threadId,
          followUpPermissionDefault: profiles.followUpPermissionDefault,
        })
        .from(questions)
        .innerJoin(profiles, eq(profiles.id, questions.recipientProfileId))
        .where(eq(questions.publicId, publicId))
        .limit(1);

      return question;
    },
    async findDraftItemByQuestionId(questionId) {
      const [draft] = await database
        .select({
          id: threadItems.id,
          answerText: threadItems.answerText,
          displayQuestionText: threadItems.displayQuestionText,
          questionTextMode: threadItems.questionTextMode,
          followUpPermissionOverride: threads.followUpPermissionOverride,
          updatedAt: threadItems.updatedAt,
        })
        .from(threadItems)
        .innerJoin(threads, eq(threads.id, threadItems.threadId))
        .where(
          and(
            eq(threadItems.questionId, questionId),
            eq(threadItems.status, "draft"),
            isNull(threadItems.deletedAt),
          ),
        )
        .limit(1);

      return draft;
    },
    async findDraftAnswerQuestionsForOwner({ profileId, userId }) {
      const rows = await database
        .select({
          questionId: questions.id,
          questionPublicId: questions.publicId,
          recipientProfileId: questions.recipientProfileId,
          recipientUserId: questions.recipientUserId,
          questionText: questions.originalText,
          answerText: threadItems.answerText,
          itemUpdatedAt: threadItems.updatedAt,
          questionCreatedAt: questions.createdAt,
          deletedAt: questions.deletedAt,
          status: questions.status,
        })
        .from(questions)
        .innerJoin(threadItems, eq(threadItems.questionId, questions.id))
        .where(
          and(
            eq(questions.recipientProfileId, profileId),
            eq(questions.recipientUserId, userId),
            eq(questions.status, "draft"),
            isNull(questions.deletedAt),
            eq(threadItems.status, "draft"),
            isNull(threadItems.deletedAt),
          ),
        )
        .orderBy(desc(threadItems.updatedAt));

      return rows;
    },
    async saveDraftAnswer(params) {
      await database.transaction(async (transaction) => {
        const thread = await upsertThread({
          params,
          published: false,
          transaction,
        });

        await upsertThreadItem({
          params,
          published: false,
          thread,
          transaction,
        });

        await transaction
          .update(questions)
          .set({
            status: "draft",
            threadId: thread.id,
            updatedAt: params.now,
          })
          .where(eq(questions.id, params.question.id));
      });
    },
    async publishAnswer(params) {
      return database.transaction(async (transaction) => {
        const thread = await upsertThread({
          params,
          published: true,
          transaction,
        });

        const item = await upsertThreadItem({
          params,
          published: true,
          thread,
          transaction,
        });
        const firstPublish = item.previousStatus !== "published";

        await transaction
          .update(questions)
          .set({
            status: "answered",
            threadId: thread.id,
            updatedAt: params.now,
          })
          .where(eq(questions.id, params.question.id));

        if (firstPublish && params.question.askerUserId !== null) {
          await transaction
            .insert(notifications)
            .values({
              id: params.createDatabaseId(),
              recipientUserId: params.question.askerUserId,
              type: "question_answered",
              actorUserId: params.actorUserId,
              threadId: thread.id,
              threadItemId: item.id,
              questionId: params.question.id,
              readAt: null,
              createdAt: params.now,
              expiresAt: addDays(params.now, 180),
            })
            .onConflictDoNothing();
        }

        return {
          notified: firstPublish && params.question.askerUserId !== null,
        };
      });
    },
  };
}

async function findEditableQuestion({
  publicId,
  session,
  store,
}: {
  publicId: string;
  session: CompletedProfileSessionSummary;
  store: AnswerStore;
}): Promise<
  | {
      status: "allowed";
      question: AnswerWorkflowQuestion;
    }
  | {
      status: "denied";
      reason: AnswerDeniedReason;
    }
> {
  const question = await store.findQuestionForAnswer(publicId);

  if (
    question?.recipientProfileId !== session.profile.id ||
    question.recipientUserId !== session.user.id ||
    question.deletedAt !== null
  ) {
    return { status: "denied", reason: "not_found" };
  }

  if (!isEditableQuestionStatus(question.status)) {
    return { status: "denied", reason: "closed" };
  }

  return {
    status: "allowed",
    question,
  };
}

async function upsertThread({
  params,
  published,
  transaction,
}: {
  params: AnswerMutationParams;
  published: boolean;
  transaction: Parameters<Parameters<RuntimeDatabase["transaction"]>[0]>[0];
}): Promise<ExistingThread> {
  const existingThread = await findExistingThread({
    question: params.question,
    transaction,
  });
  const status = published ? "published" : "draft";
  const publishedAt = published
    ? (existingThread?.publishedAt ?? params.now)
    : existingThread?.publishedAt;

  if (existingThread === undefined) {
    const thread = {
      id: params.createDatabaseId(),
      publicId: params.createThreadPublicId(),
      status,
      publishedAt: publishedAt ?? null,
    } satisfies ExistingThread;

    await transaction.insert(threads).values({
      id: thread.id,
      publicId: thread.publicId,
      ownerProfileId: params.question.recipientProfileId,
      initialQuestionId: params.question.id,
      status,
      followUpPermissionOverride: params.submission.followUpPermissionOverride,
      followUpsEnabled: true,
      publishedAt: thread.publishedAt,
      createdAt: params.now,
      updatedAt: params.now,
    });

    return thread;
  }

  await transaction
    .update(threads)
    .set({
      status,
      followUpPermissionOverride: params.submission.followUpPermissionOverride,
      publishedAt: publishedAt ?? null,
      updatedAt: params.now,
    })
    .where(
      and(
        eq(threads.id, existingThread.id),
        eq(threads.ownerProfileId, params.question.recipientProfileId),
      ),
    );

  return {
    ...existingThread,
    status,
    publishedAt: publishedAt ?? null,
  };
}

async function upsertThreadItem({
  params,
  published,
  thread,
  transaction,
}: {
  params: AnswerMutationParams;
  published: boolean;
  thread: ExistingThread;
  transaction: Parameters<Parameters<RuntimeDatabase["transaction"]>[0]>[0];
}): Promise<ExistingThreadItem & { previousStatus: ExistingThreadItem["status"] | undefined }> {
  const existingItem = await findExistingThreadItem({
    questionId: params.question.id,
    transaction,
  });
  const status = published ? "published" : "draft";
  const publishedAt = published
    ? (existingItem?.publishedAt ?? params.now)
    : existingItem?.publishedAt;
  const displayQuestionText = getDisplayQuestionText({
    question: params.question,
    submission: params.submission,
  });

  if (existingItem === undefined) {
    const item = {
      id: params.createDatabaseId(),
      publicId: params.createThreadItemPublicId(),
      status,
      publishedAt: publishedAt ?? null,
    } satisfies ExistingThreadItem;

    await transaction.insert(threadItems).values({
      id: item.id,
      publicId: item.publicId,
      threadId: thread.id,
      questionId: params.question.id,
      answerText: params.submission.answerText,
      displayQuestionText,
      questionTextMode: params.submission.questionTextMode,
      status,
      position: 0,
      publishedAt: item.publishedAt,
      createdAt: params.now,
      updatedAt: params.now,
      deletedAt: null,
    });

    return {
      ...item,
      previousStatus: undefined,
    };
  }

  await transaction
    .update(threadItems)
    .set({
      answerText: params.submission.answerText,
      displayQuestionText,
      questionTextMode: params.submission.questionTextMode,
      status,
      publishedAt: publishedAt ?? null,
      updatedAt: params.now,
    })
    .where(eq(threadItems.id, existingItem.id));

  return {
    ...existingItem,
    status,
    publishedAt: publishedAt ?? null,
    previousStatus: existingItem.status,
  };
}

async function findExistingThread({
  question,
  transaction,
}: {
  question: AnswerWorkflowQuestion;
  transaction: Parameters<Parameters<RuntimeDatabase["transaction"]>[0]>[0];
}) {
  const [thread] = await transaction
    .select({
      id: threads.id,
      publicId: threads.publicId,
      status: threads.status,
      publishedAt: threads.publishedAt,
    })
    .from(threads)
    .where(
      question.threadId === null
        ? eq(threads.initialQuestionId, question.id)
        : or(
            eq(threads.id, question.threadId),
            eq(threads.initialQuestionId, question.id),
          ),
    )
    .limit(1);

  return thread;
}

async function findExistingThreadItem({
  questionId,
  transaction,
}: {
  questionId: string;
  transaction: Parameters<Parameters<RuntimeDatabase["transaction"]>[0]>[0];
}) {
  const [item] = await transaction
    .select({
      id: threadItems.id,
      publicId: threadItems.publicId,
      status: threadItems.status,
      publishedAt: threadItems.publishedAt,
    })
    .from(threadItems)
    .where(eq(threadItems.questionId, questionId))
    .limit(1);

  return item;
}

function toAnswerFormValues(
  draft: StoredAnswerDraftItem | undefined,
): AnswerFormValues {
  return {
    intent: "save_draft",
    answerText: draft?.answerText ?? "",
    questionTextMode: draft?.questionTextMode ?? "original",
    editedQuestionText:
      draft?.questionTextMode === "edited"
        ? (draft.displayQuestionText ?? "")
        : "",
    followUpPermissionOverride: draft?.followUpPermissionOverride ?? null,
  };
}

function getAnswerFormValues(formData: FormData): AnswerFormValues {
  const intent = getFormText(formData, "intent");
  const questionTextMode = getFormText(formData, "questionTextMode");
  const followUpPermissionOverride = getFormText(
    formData,
    "followUpPermissionOverride",
  );

  return {
    intent: isAnswerIntent(intent) ? intent : "unknown",
    answerText: getFormText(formData, "answerText")?.trim() ?? "",
    questionTextMode: isQuestionTextMode(questionTextMode)
      ? questionTextMode
      : "unknown",
    editedQuestionText:
      getFormText(formData, "editedQuestionText")?.trim() ?? "",
    followUpPermissionOverride:
      followUpPermissionOverride === undefined ||
      followUpPermissionOverride.trim().length === 0
        ? null
        : isFollowUpPermission(followUpPermissionOverride)
          ? followUpPermissionOverride
          : "unknown",
  };
}

function getAnswerFieldErrors(error: ZodError): AnswerFieldErrors {
  const fieldErrors: AnswerFieldErrors = {};

  for (const issue of error.issues) {
    const field = issue.path[0];

    if (field === "intent" && fieldErrors.intent === undefined) {
      fieldErrors.intent = issue.message;
    }

    if (field === "answerText" && fieldErrors.answerText === undefined) {
      fieldErrors.answerText = issue.message;
    }

    if (
      field === "questionTextMode" &&
      fieldErrors.questionTextMode === undefined
    ) {
      fieldErrors.questionTextMode = issue.message;
    }

    if (
      field === "editedQuestionText" &&
      fieldErrors.editedQuestionText === undefined
    ) {
      fieldErrors.editedQuestionText = issue.message;
    }

    if (
      field === "followUpPermissionOverride" &&
      fieldErrors.followUpPermissionOverride === undefined
    ) {
      fieldErrors.followUpPermissionOverride = issue.message;
    }
  }

  return fieldErrors;
}

function getDisplayQuestionText({
  question,
  submission,
}: {
  question: AnswerWorkflowQuestion;
  submission: AnswerSubmission;
}) {
  if (submission.questionTextMode === "hidden") {
    return null;
  }

  if (submission.questionTextMode === "edited") {
    return submission.editedQuestionText ?? "";
  }

  return question.originalText;
}

function deniedResult(
  values: AnswerFormValues,
  reason: AnswerDeniedReason,
): AnswerActionResult {
  return {
    status: "denied",
    values,
    reason,
    formError: getDeniedMessage(reason),
  };
}

function getDeniedMessage(reason: AnswerDeniedReason) {
  switch (reason) {
    case "not_found":
      return "Question could not be found.";
    case "closed":
      return "This question is no longer available for answering.";
    case "suspended":
      return "Answering is unavailable while this account is suspended.";
  }
}

function createAnswerPreview(answerText: string) {
  const normalized = answerText.replaceAll(/\s+/g, " ").trim();

  if (normalized.length <= 160) {
    return normalized;
  }

  return `${normalized.slice(0, 157).trimEnd()}...`;
}

function isEditableQuestionStatus(status: AnswerQuestionStatus) {
  return status === "inbox" || status === "draft";
}

function isAnswerIntent(value: string | undefined): value is AnswerIntent {
  return answerIntentValues.includes(value as AnswerIntent);
}

function isQuestionTextMode(
  value: string | undefined,
): value is QuestionTextMode {
  return (
    value === "original" ||
    value === "edited" ||
    value === "hidden"
  );
}

function isFollowUpPermission(
  value: string | undefined,
): value is FollowUpPermission {
  return (
    value === "anyone" ||
    value === "logged_in" ||
    value === "original_asker" ||
    value === "off"
  );
}

function getFormText(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : undefined;
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export type PublicAnswerQuestionTextMode = QuestionTextMode;

export interface PublicPublishedAnswer {
  publicId: string;
  answerText: string;
  publishedAt: string;
  pinPosition: number | null;
  questionTextMode: PublicAnswerQuestionTextMode;
  questionText: string | null;
  asker:
    | {
        displayName: string;
        username: string;
      }
      | undefined;
}

export interface PublicPublishedAnswerRow {
  publicId: string;
  answerText: string;
  itemStatus: "draft" | "published" | "unpublished" | "deleted";
  itemDeletedAt: Date | null;
  publishedAt: Date | null;
  createdAt: Date;
  pinPosition: number | null;
  threadStatus: "draft" | "published" | "unpublished" | "deleted";
  questionStatus: "inbox" | "filtered" | "draft" | "answered";
  questionDeletedAt: Date | null;
  questionTextMode: PublicAnswerQuestionTextMode;
  displayQuestionText: string | null;
  identityMode: AnswerQuestionIdentity;
  askerDisplayName: string | null;
  askerUsername: string | null;
}

export async function findPublishedAnswersForProfile({
  database = getRuntimeDatabase(),
  profileId,
}: {
  profileId: string;
  database?: RuntimeDatabase;
}): Promise<PublicPublishedAnswer[]> {
  const askerProfiles = alias(profiles, "answer_asker_profiles");
  const rows = await database
    .select({
      publicId: threadItems.publicId,
      answerText: threadItems.answerText,
      itemStatus: threadItems.status,
      itemDeletedAt: threadItems.deletedAt,
      publishedAt: threadItems.publishedAt,
      createdAt: threadItems.createdAt,
      pinPosition: pinnedAnswers.position,
      threadStatus: threads.status,
      questionStatus: questions.status,
      questionDeletedAt: questions.deletedAt,
      questionTextMode: threadItems.questionTextMode,
      displayQuestionText: threadItems.displayQuestionText,
      identityMode: questions.identityMode,
      askerDisplayName: askerProfiles.displayName,
      askerUsername: askerProfiles.username,
    })
    .from(threadItems)
    .innerJoin(threads, eq(threads.id, threadItems.threadId))
    .innerJoin(questions, eq(questions.id, threadItems.questionId))
    .leftJoin(askerProfiles, eq(askerProfiles.id, questions.askerProfileId))
    .leftJoin(
      pinnedAnswers,
      and(
        eq(pinnedAnswers.profileId, threads.ownerProfileId),
        eq(pinnedAnswers.threadItemId, threadItems.id),
      ),
    )
    .where(
      and(
        eq(threads.ownerProfileId, profileId),
        eq(threads.status, "published"),
        eq(threadItems.status, "published"),
        isNull(threadItems.deletedAt),
      ),
    )
    .orderBy(
      sql`${pinnedAnswers.position} asc nulls last`,
      desc(threadItems.publishedAt),
      desc(threadItems.createdAt),
    );

  return createPublicPublishedAnswers(rows);
}

export function createPublicPublishedAnswers(
  rows: PublicPublishedAnswerRow[],
): PublicPublishedAnswer[] {
  return rows
    .filter(isVisiblePublishedAnswerRow)
    .sort(comparePublicPublishedAnswerRows)
    .map(toPublicPublishedAnswer);
}

function toPublicPublishedAnswer(
  row: PublicPublishedAnswerRow,
): PublicPublishedAnswer {
  const questionText = getPublicQuestionText(row);

  return {
    publicId: row.publicId,
    answerText: row.answerText,
    publishedAt: (row.publishedAt ?? new Date(0)).toISOString(),
    pinPosition: row.pinPosition,
    questionTextMode: row.questionTextMode,
    questionText,
    asker:
      questionText !== null &&
      row.identityMode === "account_attributed" &&
      row.askerDisplayName !== null &&
      row.askerUsername !== null
        ? {
            displayName: row.askerDisplayName,
            username: row.askerUsername,
          }
        : undefined,
  };
}

function isVisiblePublishedAnswerRow(row: PublicPublishedAnswerRow) {
  return (
    row.threadStatus === "published" &&
    row.itemStatus === "published" &&
    row.itemDeletedAt === null
  );
}

function comparePublicPublishedAnswerRows(
  left: PublicPublishedAnswerRow,
  right: PublicPublishedAnswerRow,
) {
  const pinOrder = comparePinPositions(left.pinPosition, right.pinPosition);

  if (pinOrder !== 0) {
    return pinOrder;
  }

  const publishedOrder =
    (right.publishedAt?.getTime() ?? 0) - (left.publishedAt?.getTime() ?? 0);

  if (publishedOrder !== 0) {
    return publishedOrder;
  }

  return right.createdAt.getTime() - left.createdAt.getTime();
}

function comparePinPositions(left: number | null, right: number | null) {
  if (left !== null && right !== null) {
    return left - right;
  }

  if (left !== null) {
    return -1;
  }

  if (right !== null) {
    return 1;
  }

  return 0;
}

function getPublicQuestionText(row: PublicPublishedAnswerRow) {
  if (
    row.questionTextMode === "hidden" ||
    row.questionDeletedAt !== null ||
    row.questionStatus !== "answered"
  ) {
    return null;
  }

  return row.displayQuestionText;
}
