import { and, asc, desc, eq, isNull, or, sql } from "drizzle-orm";
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
import type {
  CompletedProfileSessionSummary,
  CurrentSessionSummary,
} from "~/features/auth/auth.server";
import { findThreadItemLikeSummaries } from "~/features/social/social-data.server";
import {
  getLikeControlState,
  type LikeControlState,
} from "~/features/social/social-controls";
import type { FollowUpPermission } from "~/features/settings/settings.schema";
import {
  createCompactThreadContextPreview,
  type CompactThreadContextPreview,
} from "~/features/threads/follow-up.server";
import type { PublicThreadItemRow } from "~/features/threads/public-thread.loader.server";
import { MAX_PUBLISHED_THREAD_ITEMS } from "~/features/threads/thread-permissions.server";
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
  threadPublicId: string | null;
  threadInitialQuestionId: string | null;
  threadStatus: "draft" | "published" | "unpublished" | "deleted" | null;
  threadFollowUpPermissionOverride: AnswerFollowUpPermissionOverride;
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
  status: "published";
  notified: boolean;
  threadPublicId: string;
  threadItemPublicId: string;
}

export interface AnswerPublishDeniedResult {
  status: "denied";
  reason: Extract<AnswerDeniedReason, "thread_full">;
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
  findThreadContextRows(threadId: string): Promise<PublicThreadItemRow[]>;
  saveDraftAnswer(params: AnswerMutationParams): Promise<void>;
  publishAnswer(
    params: AnswerMutationParams,
  ): Promise<AnswerPublishResult | AnswerPublishDeniedResult>;
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
  threadContext: CompactThreadContextPreview | undefined;
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

export type AnswerDeniedReason =
  | "not_found"
  | "closed"
  | "suspended"
  | "thread_full";

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
  const threadContext = await loadAnswerThreadContext({
    question: question.question,
    store,
  });

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
      values: toAnswerFormValues(draft, question.question),
      followUpPermissionDefault: question.question.followUpPermissionDefault,
      threadContext,
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

  if (publish.status === "denied") {
    return deniedResult(values, publish.reason);
  }

  return {
    status: "published",
    questionPublicId,
    redirectTo: getPublishRedirect({
      publish,
      question: question.question,
      username: session.profile.username,
    }),
    notified: publish.notified,
  };
}

export function createDrizzleAnswerStore(
  database: RuntimeDatabase = getRuntimeDatabase(),
): AnswerStore {
  return {
    async findQuestionForAnswer(publicId) {
      const questionThreads = alias(threads, "answer_question_threads");
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
          threadPublicId: questionThreads.publicId,
          threadInitialQuestionId: questionThreads.initialQuestionId,
          threadStatus: questionThreads.status,
          threadFollowUpPermissionOverride:
            questionThreads.followUpPermissionOverride,
          followUpPermissionDefault: profiles.followUpPermissionDefault,
        })
        .from(questions)
        .innerJoin(profiles, eq(profiles.id, questions.recipientProfileId))
        .leftJoin(questionThreads, eq(questionThreads.id, questions.threadId))
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
    async findThreadContextRows(threadId) {
      const askerProfiles = alias(profiles, "answer_context_asker_profiles");

      return database
        .select({
          publicId: threadItems.publicId,
          questionId: threadItems.questionId,
          answerText: threadItems.answerText,
          itemStatus: threadItems.status,
          itemDeletedAt: threadItems.deletedAt,
          publishedAt: threadItems.publishedAt,
          createdAt: threadItems.createdAt,
          position: threadItems.position,
          pinPosition: pinnedAnswers.position,
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
        .where(eq(threadItems.threadId, threadId))
        .orderBy(asc(threadItems.position), asc(threadItems.createdAt));
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
        const existingItem = await findExistingThreadItem({
          questionId: params.question.id,
          transaction,
        });
        const firstPublish = existingItem?.status !== "published";
        const existingThread = await findExistingThread({
          question: params.question,
          transaction,
        });

        if (
          firstPublish &&
          isFollowUpQuestion(params.question) &&
          existingThread !== undefined &&
          (await getVisiblePublishedThreadItemCount({
            threadId: existingThread.id,
            transaction,
          })) >= MAX_PUBLISHED_THREAD_ITEMS
        ) {
          return {
            status: "denied",
            reason: "thread_full",
          };
        }

        const thread = await upsertThread({
          params,
          published: true,
          transaction,
        });

        const item = await upsertThreadItem({
          existingItem,
          params,
          published: true,
          thread,
          transaction,
        });

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

        if (firstPublish && isFollowUpQuestion(params.question)) {
          await createFollowUpAnsweredNotifications({
            currentAskerUserId: params.question.askerUserId,
            item,
            now: params.now,
            ownerUserId: params.question.recipientUserId,
            params,
            thread,
            transaction,
          });
        }

        return {
          status: "published",
          notified: firstPublish && params.question.askerUserId !== null,
          threadPublicId: thread.publicId,
          threadItemPublicId: item.publicId,
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

  if (isFollowUpQuestion(question) && question.threadStatus !== "published") {
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
  const status = getNextThreadStatus({
    existingThread,
    published,
    question: params.question,
  });
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
  existingItem,
  params,
  published,
  thread,
  transaction,
}: {
  existingItem?: ExistingThreadItem | undefined;
  params: AnswerMutationParams;
  published: boolean;
  thread: ExistingThread;
  transaction: Parameters<Parameters<RuntimeDatabase["transaction"]>[0]>[0];
}): Promise<ExistingThreadItem & { previousStatus: ExistingThreadItem["status"] | undefined }> {
  const currentItem =
    existingItem ??
    (await findExistingThreadItem({
      questionId: params.question.id,
      transaction,
    }));
  const status = published ? "published" : "draft";
  const publishedAt = published
    ? (currentItem?.publishedAt ?? params.now)
    : currentItem?.publishedAt;
  const displayQuestionText = getDisplayQuestionText({
    question: params.question,
    submission: params.submission,
  });

  if (currentItem === undefined) {
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
      position: await getNewThreadItemPosition({
        params,
        thread,
        transaction,
      }),
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
    .where(eq(threadItems.id, currentItem.id));

  return {
    ...currentItem,
    status,
    publishedAt: publishedAt ?? null,
    previousStatus: currentItem.status,
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

async function getNewThreadItemPosition({
  params,
  thread,
  transaction,
}: {
  params: AnswerMutationParams;
  thread: ExistingThread;
  transaction: Parameters<Parameters<RuntimeDatabase["transaction"]>[0]>[0];
}) {
  if (!isFollowUpQuestion(params.question)) {
    return 0;
  }

  const [row] = await transaction
    .select({
      position: sql<number>`coalesce(max(${threadItems.position}), -1) + 1`,
    })
    .from(threadItems)
    .where(eq(threadItems.threadId, thread.id))
    .limit(1);

  return row?.position ?? 0;
}

async function getVisiblePublishedThreadItemCount({
  threadId,
  transaction,
}: {
  threadId: string;
  transaction: Parameters<Parameters<RuntimeDatabase["transaction"]>[0]>[0];
}) {
  const [row] = await transaction
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(threadItems)
    .where(
      and(
        eq(threadItems.threadId, threadId),
        eq(threadItems.status, "published"),
        isNull(threadItems.deletedAt),
      ),
    );

  return row?.count ?? 0;
}

async function createFollowUpAnsweredNotifications({
  currentAskerUserId,
  item,
  now,
  ownerUserId,
  params,
  thread,
  transaction,
}: {
  params: AnswerMutationParams;
  thread: ExistingThread;
  item: ExistingThreadItem;
  ownerUserId: string;
  currentAskerUserId: string | null;
  now: Date;
  transaction: Parameters<Parameters<RuntimeDatabase["transaction"]>[0]>[0];
}) {
  const participantUserIds = await findFollowUpAnsweredRecipientUserIds({
    actorUserId: params.actorUserId,
    currentAskerUserId,
    ownerUserId,
    threadId: thread.id,
    transaction,
  });

  for (const recipientUserId of participantUserIds) {
    await transaction
      .insert(notifications)
      .values({
        id: params.createDatabaseId(),
        recipientUserId,
        type: "follow_up_answered",
        actorUserId: params.actorUserId,
        threadId: thread.id,
        threadItemId: item.id,
        questionId: params.question.id,
        readAt: null,
        createdAt: now,
        expiresAt: addDays(now, 180),
      })
      .onConflictDoNothing();
  }
}

async function findFollowUpAnsweredRecipientUserIds({
  actorUserId,
  currentAskerUserId,
  ownerUserId,
  threadId,
  transaction,
}: {
  threadId: string;
  ownerUserId: string;
  actorUserId: string;
  currentAskerUserId: string | null;
  transaction: Parameters<Parameters<RuntimeDatabase["transaction"]>[0]>[0];
}) {
  const rows = await transaction
    .select({
      askerUserId: questions.askerUserId,
    })
    .from(threadItems)
    .innerJoin(questions, eq(questions.id, threadItems.questionId))
    .where(
      and(
        eq(threadItems.threadId, threadId),
        eq(threadItems.status, "published"),
        isNull(threadItems.deletedAt),
      ),
    );
  const excludedUserIds = new Set([
    ownerUserId,
    actorUserId,
    currentAskerUserId,
    null,
  ]);

  return [
    ...new Set(
      rows
        .map((row) => row.askerUserId)
        .filter(
          (userId): userId is string =>
            userId !== null && !excludedUserIds.has(userId),
        ),
    ),
  ];
}

function getNextThreadStatus({
  existingThread,
  published,
  question,
}: {
  existingThread: ExistingThread | undefined;
  question: AnswerWorkflowQuestion;
  published: boolean;
}): ExistingThread["status"] {
  if (existingThread !== undefined && isFollowUpQuestion(question)) {
    return existingThread.status;
  }

  return published ? "published" : "draft";
}

async function loadAnswerThreadContext({
  question,
  store,
}: {
  question: AnswerWorkflowQuestion;
  store: AnswerStore;
}) {
  if (
    !isFollowUpQuestion(question) ||
    question.threadId === null ||
    question.threadInitialQuestionId === null
  ) {
    return undefined;
  }

  return createCompactThreadContextPreview({
    initialQuestionId: question.threadInitialQuestionId,
    rows: await store.findThreadContextRows(question.threadId),
  });
}

function toAnswerFormValues(
  draft: StoredAnswerDraftItem | undefined,
  question: AnswerWorkflowQuestion,
): AnswerFormValues {
  return {
    intent: "save_draft",
    answerText: draft?.answerText ?? "",
    questionTextMode: draft?.questionTextMode ?? "original",
    editedQuestionText:
      draft?.questionTextMode === "edited"
        ? (draft.displayQuestionText ?? "")
        : "",
    followUpPermissionOverride:
      draft?.followUpPermissionOverride ??
      getInitialFollowUpPermissionOverride(question),
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
    case "thread_full":
      return "This thread already has the maximum number of published answers.";
  }
}

function getPublishRedirect({
  publish,
  question,
  username,
}: {
  publish: AnswerPublishResult;
  question: AnswerWorkflowQuestion;
  username: string;
}) {
  if (isFollowUpQuestion(question)) {
    return `/${username}/a/${publish.threadPublicId}#item-${publish.threadItemPublicId}`;
  }

  return `/${username}#published-answers`;
}

function getInitialFollowUpPermissionOverride(
  question: AnswerWorkflowQuestion,
): AnswerFollowUpPermissionOverride {
  return isFollowUpQuestion(question)
    ? question.threadFollowUpPermissionOverride
    : null;
}

function isFollowUpQuestion(question: AnswerWorkflowQuestion) {
  return (
    question.threadId !== null &&
    question.threadInitialQuestionId !== question.id
  );
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
  threadPublicId: string;
  answerText: string;
  publishedAt: string;
  pinPosition: number | null;
  questionTextMode: PublicAnswerQuestionTextMode;
  questionText: string | null;
  like: LikeControlState;
  asker:
    | {
        displayName: string;
        username: string;
      }
      | undefined;
}

export interface PublicPublishedAnswerRow {
  threadItemId: string;
  publicId: string;
  threadPublicId: string;
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
  ownerProfileId: string;
  ownerUserId: string;
  ownerShowLikeCounts: boolean;
  likeCount: number;
  viewerLiked: boolean;
}

export async function findPublishedAnswersForProfile({
  database = getRuntimeDatabase(),
  profileId,
  session = anonymousSession,
}: {
  profileId: string;
  database?: RuntimeDatabase;
  session?: CurrentSessionSummary | undefined;
}): Promise<PublicPublishedAnswer[]> {
  const askerProfiles = alias(profiles, "answer_asker_profiles");
  const rows = await database
    .select({
      threadItemId: threadItems.id,
      publicId: threadItems.publicId,
      threadPublicId: threads.publicId,
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
      ownerProfileId: profiles.id,
      ownerUserId: profiles.userId,
      ownerShowLikeCounts: profiles.showLikeCounts,
    })
    .from(threadItems)
    .innerJoin(threads, eq(threads.id, threadItems.threadId))
    .innerJoin(profiles, eq(profiles.id, threads.ownerProfileId))
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

  const summaries = await findThreadItemLikeSummaries({
    database,
    threadItemIds: rows.map((row) => row.threadItemId),
    viewerProfileId: getViewerProfileId(session),
  });

  return createPublicPublishedAnswers(
    rows.map((row) => {
      const summary = summaries.get(row.threadItemId);

      return {
        ...row,
        likeCount: summary?.count ?? 0,
        viewerLiked: summary?.isLikedByViewer ?? false,
      };
    }),
    { session },
  );
}

export function createPublicPublishedAnswers(
  rows: PublicPublishedAnswerRow[],
  {
    session = anonymousSession,
  }: {
    session?: CurrentSessionSummary | undefined;
  } = {},
): PublicPublishedAnswer[] {
  return rows
    .filter(isVisiblePublishedAnswerRow)
    .sort(comparePublicPublishedAnswerRows)
    .map((row) => toPublicPublishedAnswer(row, session));
}

function toPublicPublishedAnswer(
  row: PublicPublishedAnswerRow,
  session: CurrentSessionSummary,
): PublicPublishedAnswer {
  const questionText = getPublicQuestionText(row);

  return {
    publicId: row.publicId,
    threadPublicId: row.threadPublicId,
    answerText: row.answerText,
    publishedAt: (row.publishedAt ?? new Date(0)).toISOString(),
    pinPosition: row.pinPosition,
    questionTextMode: row.questionTextMode,
    questionText,
    like: getLikeControlState({
      count: row.ownerShowLikeCounts ? row.likeCount : undefined,
      isLiked: row.viewerLiked,
      session,
      target: {
        ownerProfileId: row.ownerProfileId,
        ownerUserId: row.ownerUserId,
        threadItemPublicId: row.publicId,
      },
    }),
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

function getViewerProfileId(session: CurrentSessionSummary) {
  return session.status === "authenticated" && session.profileStatus === "complete"
    ? session.profile.id
    : undefined;
}

const anonymousSession = {
  status: "anonymous",
} satisfies CurrentSessionSummary;
