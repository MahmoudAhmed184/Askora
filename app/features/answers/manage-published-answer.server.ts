import { and, asc, eq, isNull } from "drizzle-orm";
import type { ZodError } from "zod";

import { getRuntimeDatabase, type RuntimeDatabase } from "~/db/client.server";
import { pinnedAnswers, profiles, threadItems, threads } from "~/db/schema";
import {
  publishedAnswerActionIntentValues,
  publishedAnswerActionSchema,
  type PublishedAnswerActionIntent,
  type PublishedAnswerActionSubmission,
} from "~/features/answers/answer.schema";
import type { CompletedProfileSessionSummary } from "~/features/auth/auth.server";
import { parseFormData } from "~/lib/zod-form";

const pinnedAnswerPositionValues = [1, 2, 3] as const;

export interface ManagedPublishedAnswer {
  id: string;
  publicId: string;
  threadId: string;
  questionId: string;
  ownerProfileId: string;
  ownerUserId: string;
  initialQuestionId: string;
  itemStatus: "draft" | "published" | "unpublished" | "deleted";
  threadStatus: "draft" | "published" | "unpublished" | "deleted";
  publishedAt: Date | null;
  deletedAt: Date | null;
}

export interface PublishedAnswerActionFormValues {
  intent: PublishedAnswerActionIntent | "unknown";
  answerText: string;
}

export interface PublishedAnswerActionFieldErrors {
  intent?: string;
  answerText?: string;
}

export type PublishedAnswerActionDeniedReason =
  | "not_found"
  | "pin_limit"
  | "suspended";

export type PublishedAnswerActionResult =
  | {
      status: "edited" | "unpublished" | "deleted" | "pinned" | "unpinned";
      threadItemPublicId: string;
      redirectTo: string;
    }
  | {
      status: "invalid";
      values: PublishedAnswerActionFormValues;
      fieldErrors: PublishedAnswerActionFieldErrors;
      formError: string;
    }
  | {
      status: "denied";
      values: PublishedAnswerActionFormValues;
      reason: PublishedAnswerActionDeniedReason;
      formError: string;
    };

export interface PinPublishedAnswerResult {
  status: "pinned" | "limit_reached";
}

export interface PublishedAnswerManagementStore {
  findPublishedAnswerForManagement(
    publicId: string,
  ): Promise<ManagedPublishedAnswer | undefined>;
  editPublishedAnswer(params: PublishedAnswerMutationParams): Promise<void>;
  unpublishPublishedAnswer(params: PublishedAnswerMutationParams): Promise<void>;
  deletePublishedAnswer(params: PublishedAnswerMutationParams): Promise<void>;
  pinPublishedAnswer(
    params: PublishedAnswerMutationParams,
  ): Promise<PinPublishedAnswerResult>;
  unpinPublishedAnswer(params: PublishedAnswerMutationParams): Promise<void>;
}

export interface PublishedAnswerMutationParams {
  answer: ManagedPublishedAnswer;
  form: PublishedAnswerActionSubmission;
  now: Date;
}

type DatabaseTransaction = Parameters<
  Parameters<RuntimeDatabase["transaction"]>[0]
>[0];

export async function handlePublishedAnswerAction({
  formData,
  now = new Date(),
  session,
  store = createDrizzlePublishedAnswerManagementStore(),
  threadItemPublicId,
}: {
  formData: FormData;
  threadItemPublicId: string;
  session: CompletedProfileSessionSummary;
  store?: PublishedAnswerManagementStore;
  now?: Date;
}): Promise<PublishedAnswerActionResult> {
  const values = getPublishedAnswerActionFormValues(formData);

  if (session.suspensionStatus === "active") {
    return deniedResult(values, "suspended");
  }

  const parsed = parseFormData(publishedAnswerActionSchema, formData);

  if (!parsed.ok) {
    return {
      status: "invalid",
      values,
      fieldErrors: getPublishedAnswerFieldErrors(parsed.error),
      formError: "Check the answer action and try again.",
    };
  }

  const answer = await findOwnedPublishedAnswer({
    publicId: threadItemPublicId,
    session,
    store,
  });

  if (answer === undefined) {
    return deniedResult(values, "not_found");
  }

  return mutatePublishedAnswer({
    answer,
    form: parsed.value,
    now,
    session,
    store,
    values,
  });
}

export function createDrizzlePublishedAnswerManagementStore(
  database: RuntimeDatabase = getRuntimeDatabase(),
): PublishedAnswerManagementStore {
  return {
    async findPublishedAnswerForManagement(publicId) {
      const [answer] = await database
        .select({
          id: threadItems.id,
          publicId: threadItems.publicId,
          threadId: threadItems.threadId,
          questionId: threadItems.questionId,
          ownerProfileId: threads.ownerProfileId,
          ownerUserId: profiles.userId,
          initialQuestionId: threads.initialQuestionId,
          itemStatus: threadItems.status,
          threadStatus: threads.status,
          publishedAt: threadItems.publishedAt,
          deletedAt: threadItems.deletedAt,
        })
        .from(threadItems)
        .innerJoin(threads, eq(threads.id, threadItems.threadId))
        .innerJoin(profiles, eq(profiles.id, threads.ownerProfileId))
        .where(eq(threadItems.publicId, publicId))
        .limit(1);

      return answer;
    },
    async editPublishedAnswer({ answer, form, now }) {
      if (form.intent !== "edit") {
        return;
      }

      await database
        .update(threadItems)
        .set({
          answerText: form.answerText,
          updatedAt: now,
        })
        .where(visiblePublishedAnswerWhere(answer));
    },
    async unpublishPublishedAnswer(params) {
      await database.transaction(async (transaction) => {
        await deletePinnedAnswerRow({ params, transaction });
        await transaction
          .update(threadItems)
          .set({
            status: "unpublished",
            updatedAt: params.now,
          })
          .where(visiblePublishedAnswerWhere(params.answer));

        if (isInitialThreadItem(params.answer)) {
          await markThreadStatus({
            answer: params.answer,
            status: "unpublished",
            transaction,
            updatedAt: params.now,
          });
        }
      });
    },
    async deletePublishedAnswer(params) {
      await database.transaction(async (transaction) => {
        await deletePinnedAnswerRow({ params, transaction });
        await transaction
          .update(threadItems)
          .set({
            status: "deleted",
            deletedAt: params.now,
            deletedBy: "owner",
            updatedAt: params.now,
          })
          .where(visiblePublishedAnswerWhere(params.answer));

        if (isInitialThreadItem(params.answer)) {
          await markThreadStatus({
            answer: params.answer,
            status: "deleted",
            transaction,
            updatedAt: params.now,
          });
        }
      });
    },
    async pinPublishedAnswer(params) {
      return database.transaction(async (transaction) => {
        const existingPin = await findPinnedAnswerRow({ params, transaction });

        if (existingPin !== undefined) {
          return { status: "pinned" };
        }

        const position = await findLowestOpenPinPosition({
          profileId: params.answer.ownerProfileId,
          transaction,
        });

        if (position === undefined) {
          return { status: "limit_reached" };
        }

        await transaction
          .insert(pinnedAnswers)
          .values({
            profileId: params.answer.ownerProfileId,
            threadItemId: params.answer.id,
            position,
            createdAt: params.now,
          })
          .onConflictDoNothing();

        return { status: "pinned" };
      });
    },
    async unpinPublishedAnswer(params) {
      await database.transaction(async (transaction) => {
        await deletePinnedAnswerRow({ params, transaction });
      });
    },
  };
}

async function mutatePublishedAnswer({
  answer,
  form,
  now,
  session,
  store,
  values,
}: {
  answer: ManagedPublishedAnswer;
  form: PublishedAnswerActionSubmission;
  now: Date;
  session: CompletedProfileSessionSummary;
  store: PublishedAnswerManagementStore;
  values: PublishedAnswerActionFormValues;
}): Promise<PublishedAnswerActionResult> {
  const mutationParams = { answer, form, now };

  switch (form.intent) {
    case "edit":
      await store.editPublishedAnswer(mutationParams);
      return successResult("edited", answer.publicId, session);
    case "unpublish":
      await store.unpublishPublishedAnswer(mutationParams);
      return successResult("unpublished", answer.publicId, session);
    case "delete":
      await store.deletePublishedAnswer(mutationParams);
      return successResult("deleted", answer.publicId, session);
    case "pin": {
      const result = await store.pinPublishedAnswer(mutationParams);

      if (result.status === "limit_reached") {
        return deniedResult(values, "pin_limit");
      }

      return successResult("pinned", answer.publicId, session);
    }
    case "unpin":
      await store.unpinPublishedAnswer(mutationParams);
      return successResult("unpinned", answer.publicId, session);
  }
}

async function findOwnedPublishedAnswer({
  publicId,
  session,
  store,
}: {
  publicId: string;
  session: CompletedProfileSessionSummary;
  store: PublishedAnswerManagementStore;
}) {
  const answer = await store.findPublishedAnswerForManagement(publicId);

  if (answer === undefined || !isOwnedBySession({ answer, session })) {
    return undefined;
  }

  if (!isVisiblePublishedAnswer(answer)) {
    return undefined;
  }

  return answer;
}

function isOwnedBySession({
  answer,
  session,
}: {
  answer: ManagedPublishedAnswer;
  session: CompletedProfileSessionSummary;
}) {
  return (
    answer.ownerProfileId === session.profile.id &&
    answer.ownerUserId === session.user.id
  );
}

function isVisiblePublishedAnswer(answer: ManagedPublishedAnswer) {
  return (
    answer.itemStatus === "published" &&
    answer.threadStatus === "published" &&
    answer.deletedAt === null
  );
}

function isInitialThreadItem(answer: ManagedPublishedAnswer) {
  return answer.questionId === answer.initialQuestionId;
}

function visiblePublishedAnswerWhere(answer: ManagedPublishedAnswer) {
  return and(
    eq(threadItems.id, answer.id),
    eq(threadItems.status, "published"),
    isNull(threadItems.deletedAt),
  );
}

async function markThreadStatus({
  answer,
  status,
  transaction,
  updatedAt,
}: {
  answer: ManagedPublishedAnswer;
  status: "unpublished" | "deleted";
  transaction: DatabaseTransaction;
  updatedAt: Date;
}) {
  await transaction
    .update(threads)
    .set({
      status,
      updatedAt,
    })
    .where(
      and(
        eq(threads.id, answer.threadId),
        eq(threads.ownerProfileId, answer.ownerProfileId),
      ),
    );
}

async function findPinnedAnswerRow({
  params,
  transaction,
}: {
  params: PublishedAnswerMutationParams;
  transaction: DatabaseTransaction;
}) {
  const [pin] = await transaction
    .select({
      position: pinnedAnswers.position,
    })
    .from(pinnedAnswers)
    .where(
      and(
        eq(pinnedAnswers.profileId, params.answer.ownerProfileId),
        eq(pinnedAnswers.threadItemId, params.answer.id),
      ),
    )
    .limit(1);

  return pin;
}

async function deletePinnedAnswerRow({
  params,
  transaction,
}: {
  params: PublishedAnswerMutationParams;
  transaction: DatabaseTransaction;
}) {
  await transaction
    .delete(pinnedAnswers)
    .where(
      and(
        eq(pinnedAnswers.profileId, params.answer.ownerProfileId),
        eq(pinnedAnswers.threadItemId, params.answer.id),
      ),
    );
}

async function findLowestOpenPinPosition({
  profileId,
  transaction,
}: {
  profileId: string;
  transaction: DatabaseTransaction;
}) {
  const rows = await transaction
    .select({
      position: pinnedAnswers.position,
    })
    .from(pinnedAnswers)
    .where(eq(pinnedAnswers.profileId, profileId))
    .orderBy(asc(pinnedAnswers.position));
  const usedPositions = new Set(rows.map((row) => row.position));

  return pinnedAnswerPositionValues.find(
    (position) => !usedPositions.has(position),
  );
}

function successResult(
  status: Extract<
    PublishedAnswerActionResult["status"],
    "deleted" | "edited" | "pinned" | "unpublished" | "unpinned"
  >,
  threadItemPublicId: string,
  session: CompletedProfileSessionSummary,
): PublishedAnswerActionResult {
  return {
    status,
    threadItemPublicId,
    redirectTo: `/${session.profile.username}#published-answers`,
  };
}

function deniedResult(
  values: PublishedAnswerActionFormValues,
  reason: PublishedAnswerActionDeniedReason,
): PublishedAnswerActionResult {
  return {
    status: "denied",
    values,
    reason,
    formError: getDeniedMessage(reason),
  };
}

function getDeniedMessage(reason: PublishedAnswerActionDeniedReason) {
  switch (reason) {
    case "not_found":
      return "Answer could not be found.";
    case "pin_limit":
      return "You can pin up to three answers.";
    case "suspended":
      return "Published answer management is unavailable while this account is suspended.";
  }
}

function getPublishedAnswerActionFormValues(
  formData: FormData,
): PublishedAnswerActionFormValues {
  const intent = getFormText(formData, "intent");

  return {
    intent: isPublishedAnswerActionIntent(intent) ? intent : "unknown",
    answerText: getFormText(formData, "answerText")?.trim() ?? "",
  };
}

function getPublishedAnswerFieldErrors(
  error: ZodError,
): PublishedAnswerActionFieldErrors {
  const fieldErrors: PublishedAnswerActionFieldErrors = {};

  for (const issue of error.issues) {
    const field = issue.path[0];

    if (field === "intent" && fieldErrors.intent === undefined) {
      fieldErrors.intent = issue.message;
    }

    if (field === "answerText" && fieldErrors.answerText === undefined) {
      fieldErrors.answerText = issue.message;
    }
  }

  return fieldErrors;
}

function isPublishedAnswerActionIntent(
  value: string | undefined,
): value is PublishedAnswerActionIntent {
  return publishedAnswerActionIntentValues.includes(
    value as PublishedAnswerActionIntent,
  );
}

function getFormText(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : undefined;
}
