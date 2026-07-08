import { and, eq, or } from "drizzle-orm";
import type { ZodError } from "zod";

import { getRuntimeDatabase, type RuntimeDatabase } from "~/db/client.server";
import {
  answerLikeNotifications,
  authUsers,
  blocks,
  likes,
  notifications,
  profiles,
  threadItems,
  threads,
} from "~/db/schema";
import type {
  CompletedProfileSessionSummary
} from "~/features/auth/services/auth.service.server";;
import {
  getSafeReturnTo,
  likeActionSchema,
  likeIntentValues,
  type LikeActionSubmission,
  type LikeIntent,
} from "~/features/social/validations/social.validations";
import { createAnswerLikedNotification } from "~/features/notifications/services/notification.service.server";
import { createDatabaseId } from "~/lib/ids.server";
import { parseFormData } from "~/lib/zod-form";

export interface LikeableAnswer {
  id: string;
  publicId: string;
  threadId: string;
  ownerProfileId: string;
  ownerUserId: string;
  ownerIsActive: boolean;
  ownerUserDeletedAt: Date | null;
  itemStatus: "draft" | "published" | "unpublished" | "deleted";
  itemDeletedAt: Date | null;
  threadStatus: "draft" | "published" | "unpublished" | "deleted";
}

export interface LikeActionFormValues {
  intent: LikeIntent | "unknown";
  threadItemPublicId: string;
  returnTo: string | undefined;
}

export interface LikeActionFieldErrors {
  intent?: string;
  threadItemPublicId?: string;
}

export type LikeActionDeniedReason =
  | "not_found"
  | "own_answer"
  | "blocked"
  | "suspended";

export type LikeActionResult =
  | {
      status: "liked" | "unliked";
      threadItemPublicId: string;
      redirectTo: string;
      notificationCreated: boolean;
    }
  | {
      status: "invalid";
      values: LikeActionFormValues;
      fieldErrors: LikeActionFieldErrors;
      formError: string;
    }
  | {
      status: "denied";
      values: LikeActionFormValues;
      reason: LikeActionDeniedReason;
      formError: string;
    };

export interface LikeMutationParams {
  answer: LikeableAnswer;
  createId: () => string;
  now: Date;
  session: CompletedProfileSessionSummary;
}

export interface LikeMutationResult {
  notificationCreated: boolean;
}

export interface LikeActionStore {
  findAnswerForLike(publicId: string): Promise<LikeableAnswer | undefined>;
  isActorBlockedByOwner(params: {
    actorProfileId: string;
    actorUserId: string;
    ownerProfileId: string;
  }): Promise<boolean>;
  likeAnswer(params: LikeMutationParams): Promise<LikeMutationResult>;
  unlikeAnswer(params: LikeMutationParams): Promise<void>;
}

type DatabaseTransaction = Parameters<
  Parameters<RuntimeDatabase["transaction"]>[0]
>[0];

export async function handleLikeAction({
  createId = createDatabaseId,
  formData,
  now = new Date(),
  session,
  store = createDrizzleLikeActionStore(),
}: {
  formData: FormData;
  session: CompletedProfileSessionSummary;
  store?: LikeActionStore;
  createId?: () => string;
  now?: Date;
}): Promise<LikeActionResult> {
  const values = getLikeActionFormValues(formData);

  if (session.suspensionStatus === "active") {
    return deniedResult(values, "suspended");
  }

  const parsed = parseFormData(likeActionSchema, formData);

  if (!parsed.ok) {
    return invalidResult(values, parsed.error);
  }

  const answer = await findAllowedLikeAnswer({
    publicId: parsed.value.threadItemPublicId,
    session,
    store,
    values,
  });

  if (answer.status === "denied") {
    return deniedResult(values, answer.reason);
  }

  return mutateLike({
    answer: answer.answer,
    createId,
    form: parsed.value,
    now,
    session,
    store,
  });
}

export function createDrizzleLikeActionStore(
  database: RuntimeDatabase = getRuntimeDatabase(),
): LikeActionStore {
  return {
    async findAnswerForLike(publicId) {
      const [answer] = await database
        .select({
          id: threadItems.id,
          publicId: threadItems.publicId,
          threadId: threadItems.threadId,
          ownerProfileId: threads.ownerProfileId,
          ownerUserId: profiles.userId,
          ownerIsActive: profiles.isActive,
          ownerUserDeletedAt: authUsers.deletedAt,
          itemStatus: threadItems.status,
          itemDeletedAt: threadItems.deletedAt,
          threadStatus: threads.status,
        })
        .from(threadItems)
        .innerJoin(threads, eq(threads.id, threadItems.threadId))
        .innerJoin(profiles, eq(profiles.id, threads.ownerProfileId))
        .leftJoin(authUsers, eq(authUsers.id, profiles.userId))
        .where(eq(threadItems.publicId, publicId))
        .limit(1);

      return answer;
    },
    async isActorBlockedByOwner({
      actorProfileId,
      actorUserId,
      ownerProfileId,
    }) {
      const [block] = await database
        .select({ id: blocks.id })
        .from(blocks)
        .where(
          and(
            eq(blocks.ownerProfileId, ownerProfileId),
            or(
              eq(blocks.blockedUserId, actorUserId),
              eq(blocks.blockedProfileId, actorProfileId),
            ),
          ),
        )
        .limit(1);

      return block !== undefined;
    },
    async likeAnswer(params) {
      return database.transaction(async (transaction) => {
        const likeInserted = await insertLikeRow({ params, transaction });

        if (!likeInserted) {
          return { notificationCreated: false };
        }

        const notificationCreated = await createFirstLikeNotification({
          params,
          transaction,
        });

        return { notificationCreated };
      });
    },
    async unlikeAnswer(params) {
      await database
        .delete(likes)
        .where(
          and(
            eq(likes.profileId, params.session.profile.id),
            eq(likes.threadItemId, params.answer.id),
          ),
        );
    },
  };
}

async function findAllowedLikeAnswer({
  publicId,
  session,
  store,
}: {
  publicId: string;
  session: CompletedProfileSessionSummary;
  store: LikeActionStore;
  values: LikeActionFormValues;
}): Promise<
  | {
      status: "allowed";
      answer: LikeableAnswer;
    }
  | {
      status: "denied";
      reason: LikeActionDeniedReason;
    }
> {
  const answer = await store.findAnswerForLike(publicId);

  if (answer === undefined || !isVisibleLikeableAnswer(answer)) {
    return { status: "denied", reason: "not_found" };
  }

  if (isOwnAnswer({ answer, session })) {
    return { status: "denied", reason: "own_answer" };
  }

  const blocked = await store.isActorBlockedByOwner({
    actorProfileId: session.profile.id,
    actorUserId: session.user.id,
    ownerProfileId: answer.ownerProfileId,
  });

  if (blocked) {
    return { status: "denied", reason: "blocked" };
  }

  return { status: "allowed", answer };
}

async function mutateLike({
  answer,
  createId,
  form,
  now,
  session,
  store,
}: {
  answer: LikeableAnswer;
  form: LikeActionSubmission;
  now: Date;
  session: CompletedProfileSessionSummary;
  store: LikeActionStore;
  createId: () => string;
}): Promise<LikeActionResult> {
  const params = { answer, createId, now, session };

  if (form.intent === "unlike") {
    await store.unlikeAnswer(params);

    return successResult({
      form,
      notificationCreated: false,
      status: "unliked",
    });
  }

  const mutation = await store.likeAnswer(params);

  return successResult({
    form,
    notificationCreated: mutation.notificationCreated,
    status: "liked",
  });
}

async function insertLikeRow({
  params,
  transaction,
}: {
  params: LikeMutationParams;
  transaction: DatabaseTransaction;
}) {
  const [inserted] = await transaction
    .insert(likes)
    .values({
      profileId: params.session.profile.id,
      threadItemId: params.answer.id,
      createdAt: params.now,
    })
    .onConflictDoNothing()
    .returning({ threadItemId: likes.threadItemId });

  return inserted !== undefined;
}

async function createFirstLikeNotification({
  params,
  transaction,
}: {
  params: LikeMutationParams;
  transaction: DatabaseTransaction;
}) {
  const [dedupe] = await transaction
    .insert(answerLikeNotifications)
    .values({
      actorUserId: params.session.user.id,
      threadItemId: params.answer.id,
      ownerUserId: params.answer.ownerUserId,
      createdAt: params.now,
    })
    .onConflictDoNothing()
    .returning({ threadItemId: answerLikeNotifications.threadItemId });

  if (dedupe === undefined) {
    return false;
  }

  await transaction
    .insert(notifications)
    .values(
      createAnswerLikedNotification({
        id: params.createId(),
        recipientUserId: params.answer.ownerUserId,
        actorUserId: params.session.user.id,
        threadId: params.answer.threadId,
        threadItemId: params.answer.id,
        now: params.now,
      }),
    )
    .onConflictDoNothing();

  return true;
}

function successResult({
  form,
  notificationCreated,
  status,
}: {
  form: LikeActionSubmission;
  status: "liked" | "unliked";
  notificationCreated: boolean;
}): LikeActionResult {
  return {
    status,
    threadItemPublicId: form.threadItemPublicId,
    redirectTo: getSafeReturnTo(form.returnTo),
    notificationCreated,
  };
}

function invalidResult(
  values: LikeActionFormValues,
  error: ZodError,
): LikeActionResult {
  return {
    status: "invalid",
    values,
    fieldErrors: getLikeActionFieldErrors(error),
    formError: "Check the like action and try again.",
  };
}

function deniedResult(
  values: LikeActionFormValues,
  reason: LikeActionDeniedReason,
): LikeActionResult {
  return {
    status: "denied",
    values,
    reason,
    formError: getDeniedMessage(reason),
  };
}

function getDeniedMessage(reason: LikeActionDeniedReason) {
  switch (reason) {
    case "not_found":
      return "Answer could not be found.";
    case "own_answer":
      return "You cannot like your own answer.";
    case "blocked":
      return "This answer is unavailable.";
    case "suspended":
      return "Liking answers is unavailable while this account is suspended.";
  }
}

function getLikeActionFieldErrors(error: ZodError): LikeActionFieldErrors {
  const fieldErrors: LikeActionFieldErrors = {};

  for (const issue of error.issues) {
    const field = issue.path[0];

    if (field === "intent" && fieldErrors.intent === undefined) {
      fieldErrors.intent = issue.message;
    }

    if (
      field === "threadItemPublicId" &&
      fieldErrors.threadItemPublicId === undefined
    ) {
      fieldErrors.threadItemPublicId = issue.message;
    }
  }

  return fieldErrors;
}

function getLikeActionFormValues(formData: FormData): LikeActionFormValues {
  const intent = getFormText(formData, "intent");

  return {
    intent: isLikeIntent(intent) ? intent : "unknown",
    threadItemPublicId: getFormText(formData, "threadItemPublicId") ?? "",
    returnTo: getFormText(formData, "returnTo"),
  };
}

function isVisibleLikeableAnswer(answer: LikeableAnswer) {
  return (
    answer.threadStatus === "published" &&
    answer.itemStatus === "published" &&
    answer.itemDeletedAt === null &&
    answer.ownerIsActive &&
    answer.ownerUserDeletedAt === null
  );
}

function isOwnAnswer({
  answer,
  session,
}: {
  answer: LikeableAnswer;
  session: CompletedProfileSessionSummary;
}) {
  return (
    answer.ownerProfileId === session.profile.id ||
    answer.ownerUserId === session.user.id
  );
}

function isLikeIntent(value: string | undefined): value is LikeIntent {
  return likeIntentValues.includes(value as LikeIntent);
}

function getFormText(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : undefined;
}
