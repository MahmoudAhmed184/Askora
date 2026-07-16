import { and, asc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { ZodError } from "zod";

import { getRuntimeDatabase, type RuntimeDatabase } from "~/db/client.server";
import {
  authUsers,
  notifications,
  pinnedAnswers,
  profiles,
  questions,
  threadItems,
  threads,
} from "~/db/schema";
import type {
  CurrentSessionSummary
} from "~/features/auth/services/auth.service.server";;
import {
  createFollowUpAskedNotification,
  type FollowUpAskedNotification,
} from "~/features/notifications/services/notification.service.server";
import type {
  QuestionIdentityMode
} from "~/features/profiles/services/ask-permissions.service.server";;
import {
  ASK_MINIMUM_SUBMIT_MILLISECONDS,
  ASK_TIMING_TOKEN_MAX_AGE_MILLISECONDS,
  type AskTimingTokenDecision,
} from "~/features/profiles/services/ask-friction.service.server";
import {
  decideQuestionSafety,
  type PublicQuestionSafetyInput,
  type QuestionSafetyDecision,
} from "~/features/profiles/services/ask-question.service.server";
import {
  publicQuestionIdentityValues,
  publicQuestionSubmissionSchema,
  type PublicQuestionIdentity,
} from "~/features/profiles/validations/profile.validations";
import type { FollowUpPermission } from "~/features/settings/validations/settings.validations";
import {
  createPublicThreadItems,
  type PublicThreadAnswerItem,
  type PublicThreadItemRow,
} from "~/features/threads/queries/public-thread.queries.server";
import {
  evaluateThreadFollowUpPermission,
  getPublicThreadFollowUpState,
  type PublicThreadFollowUpState,
  type ThreadFollowUpTarget,
} from "~/features/threads/services/thread-permissions.service.server";
import {
  hashWithHmacSha256,
  sealJsonForCookie,
  unsealJsonFromCookie,
} from "~/lib/crypto.server";
import { serverEnv } from "~/lib/env.server";
import { createDatabaseId, createPublicId } from "~/lib/ids.server";
import { checkRateLimit } from "~/lib/rate-limit.server";
import { getRequestInfoHashes } from "~/lib/request-info.server";
import { parseFormData } from "~/lib/zod-form";

export const FOLLOW_UP_FLASH_COOKIE_NAME = "askora_follow_up_flash";

const FOLLOW_UP_FLASH_COOKIE_MAX_AGE_SECONDS = 120;
const FOLLOW_UP_FLASH_COOKIE_PURPOSE = "thread-follow-up-flash";
const FOLLOW_UP_TIMING_TOKEN_PURPOSE = "thread-follow-up-timing";

export interface FollowUpThreadRecord {
  id: string;
  publicId: string;
  status: "draft" | "published" | "unpublished" | "deleted";
  ownerProfileId: string;
  ownerUserId: string;
  ownerUsername: string;
  ownerDisplayName: string;
  ownerAvatarUrl: string | null;
  ownerIsActive: boolean;
  ownerUserDeletedAt: Date | null;
  anonymousQuestionsEnabled: boolean;
  followUpPermissionDefault: FollowUpPermission;
  followUpPermissionOverride: FollowUpPermission | null;
  followUpsEnabled: boolean;
  initialQuestionId: string;
  initialQuestionAskerUserId: string | null;
  publishedAt: Date | null;
}

export interface CompactThreadContextPreview {
  items: PublicThreadAnswerItem[];
  totalVisibleItems: number;
  omittedItemCount: number;
}

export type FollowUpPageData =
  | {
      status: "available";
      profile: {
        username: string;
        displayName: string;
        avatarUrl: string | null;
      };
      thread: {
        publicId: string;
        publishedAt: string;
      };
      context: CompactThreadContextPreview;
      followUp: PublicThreadFollowUpState;
      flash: FollowUpFlash | undefined;
      timingToken: string | undefined;
    }
  | {
      status: "unavailable";
      username: string;
      threadPublicId: string;
    };

export type FollowUpLoadResult =
  | {
      status: "redirect";
      username: string;
    }
  | {
      status: "page";
      page: FollowUpPageData;
      responseStatus: 200 | 404;
    };

export interface FollowUpFieldErrors {
  question?: string;
  identityMode?: string;
  timingToken?: string;
}

export interface FollowUpFormValues {
  question: string;
  identityMode: PublicQuestionIdentity;
}

export type FollowUpSubmissionResult =
  | {
      status: "redirect";
      username: string;
    }
  | {
      status: "created";
      values: FollowUpFormValues;
      identityMode: QuestionIdentityMode;
      questionPublicId: string;
    }
  | {
      status: "invalid";
      values: FollowUpFormValues;
      fieldErrors: FollowUpFieldErrors;
      formError?: string;
    }
  | {
      status: "denied";
      values: FollowUpFormValues;
      formError: string;
    }
  | {
      status: "rate_limited";
      values: FollowUpFormValues;
      retryAfterSeconds: number;
    }
  | {
      status: "dropped";
      values: FollowUpFormValues;
      reason: "honeypot" | "timing" | "safety";
      timing?: AskTimingTokenDecision;
    };

export type FollowUpFlash =
  | {
      status: "success";
      message: string;
      prompt?: string;
    }
  | {
      status: "error";
      fieldErrors?: FollowUpFieldErrors;
      formError?: string;
      values: FollowUpFormValues;
    };

export interface NewFollowUpQuestion {
  id: string;
  publicId: string;
  recipientProfileId: string;
  recipientUserId: string;
  askerUserId: string | null;
  askerProfileId: string | null;
  identityMode: QuestionIdentityMode;
  source: "public_profile";
  status: "inbox" | "filtered";
  threadId: string;
  originalText: string;
  normalizedTextHash: string;
  ipHash: string | null;
  userAgentHash: string | null;
  safetyFingerprintHash: string;
  safetyMetadataRetainUntil: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type NewFollowUpNotification = FollowUpAskedNotification;

export interface FollowUpStore {
  findThreadByPublicId(
    threadPublicId: string,
  ): Promise<FollowUpThreadRecord | undefined>;
  findThreadItems(threadId: string): Promise<PublicThreadItemRow[]>;
  createFollowUpQuestion(params: {
    question: NewFollowUpQuestion;
    notification: NewFollowUpNotification | undefined;
  }): Promise<void>;
}

type RateLimitCheck = typeof checkRateLimit;

export async function loadFollowUpPage({
  flash,
  now = new Date(),
  session,
  store = createDrizzleFollowUpStore(),
  threadPublicId,
  username,
}: {
  username: string;
  threadPublicId: string;
  session: CurrentSessionSummary;
  flash?: FollowUpFlash | undefined;
  store?: FollowUpStore | undefined;
  now?: Date | undefined;
}): Promise<FollowUpLoadResult> {
  const thread = await store.findThreadByPublicId(threadPublicId);

  if (thread === undefined) {
    return unavailableFollowUpResult({ threadPublicId, username }, 404);
  }

  const rows = await store.findThreadItems(thread.id);

  if (!isPublicThreadAvailableForFollowUps({ rows, thread })) {
    return unavailableFollowUpResult({ threadPublicId, username }, 200);
  }

  if (thread.ownerUsername !== username) {
    return {
      status: "redirect",
      username: thread.ownerUsername,
    };
  }

  const followUp = getPublicThreadFollowUpState({
    actor: session,
    target: createThreadFollowUpTarget({ rows, thread }),
  });

  return {
    status: "page",
    page: {
      status: "available",
      profile: {
        username: thread.ownerUsername,
        displayName: thread.ownerDisplayName,
        avatarUrl: thread.ownerAvatarUrl,
      },
      thread: {
        publicId: thread.publicId,
        publishedAt: getThreadPublishedAt({ rows, thread }).toISOString(),
      },
      context: createCompactThreadContextPreview({
        initialQuestionId: thread.initialQuestionId,
        rows,
      }),
      followUp,
      flash,
      timingToken:
        followUp.status === "allowed"
          ? createFollowUpTimingToken({
              now,
              profileId: thread.ownerProfileId,
              threadPublicId: thread.publicId,
              username: thread.ownerUsername,
            })
          : undefined,
    },
    responseStatus: 200,
  };
}

export async function submitThreadFollowUp({
  createId = createDatabaseId,
  createNotificationId = createDatabaseId,
  createQuestionPublicId = () => createPublicId("qst"),
  formData,
  minimumSubmitMilliseconds,
  now = new Date(),
  rateLimiter = checkRateLimit,
  request,
  safetyDecider = decideQuestionSafety,
  session,
  store = createDrizzleFollowUpStore(),
  threadPublicId,
  username,
}: {
  formData: FormData;
  request: Request;
  session: CurrentSessionSummary;
  username: string;
  threadPublicId: string;
  store?: FollowUpStore | undefined;
  rateLimiter?: RateLimitCheck | undefined;
  safetyDecider?: ((
    input: PublicQuestionSafetyInput,
  ) => Promise<QuestionSafetyDecision> | QuestionSafetyDecision) | undefined;
  createId?: (() => string) | undefined;
  createQuestionPublicId?: (() => string) | undefined;
  createNotificationId?: (() => string) | undefined;
  now?: Date | undefined;
  minimumSubmitMilliseconds?: number | undefined;
}): Promise<FollowUpSubmissionResult> {
  const values = getFollowUpFormValues(formData);
  const thread = await store.findThreadByPublicId(threadPublicId);

  if (thread === undefined) {
    return unavailableSubmissionResult(values);
  }

  const rows = await store.findThreadItems(thread.id);

  if (!isPublicThreadAvailableForFollowUps({ rows, thread })) {
    return unavailableSubmissionResult(values);
  }

  if (thread.ownerUsername !== username) {
    return {
      status: "redirect",
      username: thread.ownerUsername,
    };
  }

  if (hasHoneypotValue(formData)) {
    return { status: "dropped", values, reason: "honeypot" };
  }

  const timing = validateFollowUpTimingToken({
    minimumSubmitMilliseconds,
    now,
    profileId: thread.ownerProfileId,
    threadPublicId: thread.publicId,
    token: getFormText(formData, "timingToken"),
    username: thread.ownerUsername,
  });

  if (timing.status === "invalid") {
    if (timing.reason === "expired") {
      return {
        status: "invalid",
        values,
        fieldErrors: {
          timingToken: "This follow-up form expired. Try submitting it again.",
        },
        formError: "Your follow-up was not sent. Please try again.",
      };
    }

    return { status: "dropped", values, reason: "timing", timing };
  }

  const parsed = parseFormData(publicQuestionSubmissionSchema, formData);

  if (!parsed.ok) {
    return {
      status: "invalid",
      values,
      fieldErrors: getFollowUpFieldErrors(parsed.error),
    };
  }

  const permission = evaluateThreadFollowUpPermission({
    actor: session,
    identity: parsed.value.identityMode,
    target: createThreadFollowUpTarget({ rows, thread }),
  });

  if (permission.status === "denied") {
    return {
      status: "denied",
      values: getFollowUpValues(parsed.value),
      formError: permission.message,
    };
  }

  const requestInfo = getRequestInfoHashes(request);
  const rateLimit = await checkFollowUpRateLimits({
    actor: session,
    rateLimiter,
    requestInfo,
    thread,
    now,
  });

  if (!rateLimit.allowed) {
    return {
      status: "rate_limited",
      values: getFollowUpValues(parsed.value),
      retryAfterSeconds: rateLimit.retryAfterSeconds,
    };
  }

  const askerIdentity = getAskerIdentityFields({
    identityMode: permission.identityMode,
    session,
  });
  const safetyDecision = await safetyDecider({
    text: parsed.value.question,
    identityMode: permission.identityMode,
    targetProfileId: thread.ownerProfileId,
    ...askerIdentity,
    safetyFingerprintHash: requestInfo.fingerprintHash,
    ipHash: requestInfo.ipHash,
  });

  if (safetyDecision === "drop") {
    return {
      status: "dropped",
      values: getFollowUpValues(parsed.value),
      reason: "safety",
    };
  }

  const questionPublicId = createQuestionPublicId();
  const question = createNewFollowUpQuestion({
    id: createId(),
    identityMode: permission.identityMode,
    now,
    publicId: questionPublicId,
    requestInfo,
    session,
    status: safetyDecision === "filter" ? "filtered" : "inbox",
    text: parsed.value.question,
    thread,
  });

  await store.createFollowUpQuestion({
    question,
    notification: createFollowUpAskedNotification({
      id: createNotificationId(),
      recipientUserId: thread.ownerUserId,
      actorUserId:
        session.status === "authenticated" ? session.user.id : null,
      threadId: thread.id,
      questionId: question.id,
      now,
    }),
  });

  return {
    status: "created",
    values: getFollowUpValues(parsed.value),
    identityMode: permission.identityMode,
    questionPublicId,
  };
}

export function createDrizzleFollowUpStore(
  database: RuntimeDatabase = getRuntimeDatabase(),
): FollowUpStore {
  return {
    async findThreadByPublicId(threadPublicId) {
      const initialQuestions = alias(questions, "follow_up_initial_questions");
      const [thread] = await database
        .select({
          id: threads.id,
          publicId: threads.publicId,
          status: threads.status,
          ownerProfileId: threads.ownerProfileId,
          ownerUserId: profiles.userId,
          ownerUsername: profiles.username,
          ownerDisplayName: profiles.displayName,
          ownerAvatarUrl: profiles.avatarUrl,
          ownerIsActive: profiles.isActive,
          ownerUserDeletedAt: authUsers.deletedAt,
          anonymousQuestionsEnabled: profiles.anonymousQuestionsEnabled,
          followUpPermissionDefault: profiles.followUpPermissionDefault,
          followUpPermissionOverride: threads.followUpPermissionOverride,
          followUpsEnabled: threads.followUpsEnabled,
          initialQuestionId: threads.initialQuestionId,
          initialQuestionAskerUserId: initialQuestions.askerUserId,
          publishedAt: threads.publishedAt,
        })
        .from(threads)
        .innerJoin(profiles, eq(profiles.id, threads.ownerProfileId))
        .innerJoin(
          initialQuestions,
          eq(initialQuestions.id, threads.initialQuestionId),
        )
        .leftJoin(authUsers, eq(authUsers.id, profiles.userId))
        .where(eq(threads.publicId, threadPublicId))
        .limit(1);

      return thread;
    },
    async findThreadItems(threadId) {
      const askerProfiles = alias(profiles, "follow_up_asker_profiles");

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
    async createFollowUpQuestion({ notification, question }) {
      await database.transaction(async (transaction) => {
        await transaction.insert(questions).values(question);

        if (notification !== undefined) {
          await transaction
            .insert(notifications)
            .values(notification)
            .onConflictDoNothing();
        }
      });
    },
  };
}

export function createThreadFollowUpTarget({
  rows,
  thread,
}: {
  thread: FollowUpThreadRecord;
  rows: PublicThreadItemRow[];
}): ThreadFollowUpTarget {
  return {
    status: thread.status,
    ownerIsActive: thread.ownerIsActive,
    ownerUserDeletedAt: thread.ownerUserDeletedAt,
    anonymousQuestionsEnabled: thread.anonymousQuestionsEnabled,
    followUpsEnabled: thread.followUpsEnabled,
    followUpPermissionDefault: thread.followUpPermissionDefault,
    followUpPermissionOverride: thread.followUpPermissionOverride,
    initialQuestionAskerUserId: thread.initialQuestionAskerUserId,
    publishedItemCount: getVisiblePublishedItemCount(rows),
  };
}

export function createCompactThreadContextPreview({
  initialQuestionId,
  rows,
}: {
  initialQuestionId: string;
  rows: PublicThreadItemRow[];
}): CompactThreadContextPreview {
  const visibleItems = createPublicThreadItems({
    initialQuestionId,
    rows,
  }).filter(isAnswerItem);
  const items = getPreviewItems(visibleItems);

  return {
    items,
    totalVisibleItems: visibleItems.length,
    omittedItemCount: Math.max(0, visibleItems.length - items.length),
  };
}

export function getFollowUpFlashForResult({
  result,
  session,
}: {
  result: Exclude<FollowUpSubmissionResult, { status: "redirect" }>;
  session: CurrentSessionSummary;
}): FollowUpFlash {
  if (result.status === "rate_limited") {
    return {
      status: "error",
      values: result.values,
      formError: `Too many follow-ups. Try again in ${formatRetryAfter(result.retryAfterSeconds)}.`,
    };
  }

  if (result.status === "created" || result.status === "dropped") {
    const flash = {
      status: "success" as const,
      message: "Follow-up sent.",
    };

    if (session.status === "anonymous") {
      return {
        ...flash,
        prompt: "Create an account to get notified if this follow-up is answered.",
      };
    }

    return flash;
  }

  if (result.status === "denied") {
    return {
      status: "error",
      values: result.values,
      formError: result.formError,
    };
  }

  return {
    status: "error",
    values: result.values,
    fieldErrors: result.fieldErrors,
    ...(result.formError === undefined ? {} : { formError: result.formError }),
  };
}

export function createFollowUpTimingToken({
  now = new Date(),
  profileId,
  threadPublicId,
  username,
}: {
  profileId: string;
  username: string;
  threadPublicId: string;
  now?: Date;
}) {
  return sealJsonForCookie(
    {
      profileId,
      username,
      threadPublicId,
      createdAt: now.getTime(),
    },
    FOLLOW_UP_TIMING_TOKEN_PURPOSE,
  );
}

function formatRetryAfter(retryAfterSeconds: number) {
  if (retryAfterSeconds <= 60) {
    return "1 minute";
  }

  const retryAfterMinutes = Math.ceil(retryAfterSeconds / 60);
  return `${String(retryAfterMinutes)} minutes`;
}

export function validateFollowUpTimingToken({
  minimumSubmitMilliseconds = ASK_MINIMUM_SUBMIT_MILLISECONDS,
  now = new Date(),
  profileId,
  threadPublicId,
  token,
  username,
}: {
  token: string | undefined;
  profileId: string;
  username: string;
  threadPublicId: string;
  now?: Date | undefined;
  minimumSubmitMilliseconds?: number | undefined;
}): AskTimingTokenDecision {
  if (token === undefined || token.trim().length === 0) {
    return { status: "invalid", reason: "missing" };
  }

  const parsed = parseFollowUpTimingToken(token);

  if (parsed === undefined) {
    return { status: "invalid", reason: "malformed" };
  }

  if (
    parsed.profileId !== profileId ||
    parsed.username !== username ||
    parsed.threadPublicId !== threadPublicId
  ) {
    return { status: "invalid", reason: "mismatch" };
  }

  const ageMilliseconds = now.getTime() - parsed.createdAt;

  if (ageMilliseconds > ASK_TIMING_TOKEN_MAX_AGE_MILLISECONDS) {
    return { status: "invalid", reason: "expired" };
  }

  if (ageMilliseconds < minimumSubmitMilliseconds) {
    return { status: "invalid", reason: "too_fast" };
  }

  return { status: "valid" };
}

export function createFollowUpFlashCookieHeader({
  result,
  threadPublicId,
  username,
}: {
  username: string;
  threadPublicId: string;
  result: FollowUpFlash;
}) {
  const value = sealJsonForCookie(
    {
      username,
      threadPublicId,
      result,
      createdAt: Date.now(),
    },
    FOLLOW_UP_FLASH_COOKIE_PURPOSE,
  );

  return serializeFollowUpFlashCookie(
    value,
    FOLLOW_UP_FLASH_COOKIE_MAX_AGE_SECONDS,
  );
}

export function clearFollowUpFlashCookieHeader() {
  return serializeFollowUpFlashCookie("", 0);
}

export function readFollowUpFlashFromRequest({
  request,
  threadPublicId,
  username,
}: {
  request: Request;
  username: string;
  threadPublicId: string;
}) {
  const cookieValue = getCookieValue(
    request.headers.get("cookie"),
    FOLLOW_UP_FLASH_COOKIE_NAME,
  );

  if (cookieValue === undefined) {
    return undefined;
  }

  const unsealed = unsealJsonFromCookie(cookieValue, FOLLOW_UP_FLASH_COOKIE_PURPOSE);

  if (!isFollowUpFlashCookieValue(unsealed)) {
    return undefined;
  }

  if (unsealed.username !== username || unsealed.threadPublicId !== threadPublicId) {
    return undefined;
  }

  return unsealed.result;
}

export function hasFollowUpFlashCookie(request: Request) {
  return (
    getCookieValue(
      request.headers.get("cookie"),
      FOLLOW_UP_FLASH_COOKIE_NAME,
    ) !== undefined
  );
}

async function checkFollowUpRateLimits({
  actor,
  now,
  rateLimiter,
  requestInfo,
  thread,
}: {
  actor: CurrentSessionSummary;
  thread: FollowUpThreadRecord;
  rateLimiter: RateLimitCheck;
  requestInfo: ReturnType<typeof getRequestInfoHashes>;
  now: Date;
}) {
  const decisions = await Promise.all(
    getFollowUpRateLimitChecks({ actor, requestInfo, thread }).map((key) =>
      rateLimiter({
        key: key.key,
        max: key.max,
        windowSeconds: key.windowSeconds,
        now: () => now.getTime(),
      }),
    ),
  );

  return decisions.find((decision) => !decision.allowed) ?? { allowed: true };
}

function getFollowUpRateLimitChecks({
  actor,
  requestInfo,
  thread,
}: {
  actor: CurrentSessionSummary;
  thread: FollowUpThreadRecord;
  requestInfo: ReturnType<typeof getRequestInfoHashes>;
}) {
  if (actor.status === "anonymous") {
    return [
      {
        key: `follow-up:guest:day:${requestInfo.fingerprintHash}`,
        max: 10,
        windowSeconds: 24 * 60 * 60,
      },
      {
        key: `follow-up:guest:thread-day:${thread.id}:${requestInfo.fingerprintHash}`,
        max: 3,
        windowSeconds: 24 * 60 * 60,
      },
    ];
  }

  return [
    {
      key: `follow-up:account:day:${actor.user.id}`,
      max: 10,
      windowSeconds: 24 * 60 * 60,
    },
    {
      key: `follow-up:account:thread-day:${thread.id}:${actor.user.id}`,
      max: 3,
      windowSeconds: 24 * 60 * 60,
    },
  ];
}

function createNewFollowUpQuestion({
  id,
  identityMode,
  now,
  publicId,
  requestInfo,
  session,
  status,
  text,
  thread,
}: {
  id: string;
  publicId: string;
  thread: FollowUpThreadRecord;
  session: CurrentSessionSummary;
  identityMode: QuestionIdentityMode;
  status: "inbox" | "filtered";
  text: string;
  requestInfo: ReturnType<typeof getRequestInfoHashes>;
  now: Date;
}): NewFollowUpQuestion {
  return {
    id,
    publicId,
    recipientProfileId: thread.ownerProfileId,
    recipientUserId: thread.ownerUserId,
    ...getAskerIdentityFields({ identityMode, session }),
    identityMode,
    source: "public_profile",
    status,
    threadId: thread.id,
    originalText: text,
    normalizedTextHash: hashWithHmacSha256(
      normalizeQuestionTextForHash(text),
      "question-text",
    ),
    ipHash: requestInfo.ipHash,
    userAgentHash: requestInfo.userAgentHash,
    safetyFingerprintHash: requestInfo.fingerprintHash,
    safetyMetadataRetainUntil: addDays(now, 30),
    createdAt: now,
    updatedAt: now,
  };
}

function getAskerIdentityFields({
  identityMode,
  session,
}: {
  identityMode: QuestionIdentityMode;
  session: CurrentSessionSummary;
}): Pick<NewFollowUpQuestion, "askerUserId" | "askerProfileId"> {
  if (identityMode === "guest_anonymous" || session.status === "anonymous") {
    return {
      askerUserId: null,
      askerProfileId: null,
    };
  }

  if (identityMode === "account_anonymous" || session.profileStatus === "incomplete") {
    return {
      askerUserId: session.user.id,
      askerProfileId: null,
    };
  }

  return {
    askerUserId: session.user.id,
    askerProfileId: session.profile.id,
  };
}

function getFollowUpFormValues(formData: FormData): FollowUpFormValues {
  const identityMode = getFormText(formData, "identityMode");

  return {
    question: getFormText(formData, "question")?.trim() ?? "",
    identityMode: isPublicQuestionIdentity(identityMode)
      ? identityMode
      : "anonymous",
  };
}

function getFollowUpValues(submission: {
  question: string;
  identityMode: PublicQuestionIdentity;
}): FollowUpFormValues {
  return {
    question: submission.question,
    identityMode: submission.identityMode,
  };
}

function getFollowUpFieldErrors(error: ZodError): FollowUpFieldErrors {
  const fieldErrors: FollowUpFieldErrors = {};

  for (const issue of error.issues) {
    const field = issue.path[0];

    if (field === "question" && fieldErrors.question === undefined) {
      fieldErrors.question = issue.message;
    }

    if (field === "identityMode" && fieldErrors.identityMode === undefined) {
      fieldErrors.identityMode = issue.message;
    }

    if (field === "timingToken" && fieldErrors.timingToken === undefined) {
      fieldErrors.timingToken = issue.message;
    }
  }

  return fieldErrors;
}

function unavailableSubmissionResult(
  values: FollowUpFormValues,
): FollowUpSubmissionResult {
  return {
    status: "denied",
    values,
    formError: "This thread is unavailable for follow-ups.",
  };
}

function unavailableFollowUpResult(
  page: {
    username: string;
    threadPublicId: string;
  },
  responseStatus: 200 | 404,
): FollowUpLoadResult {
  return {
    status: "page",
    page: {
      status: "unavailable",
      username: page.username,
      threadPublicId: page.threadPublicId,
    },
    responseStatus,
  };
}

function isPublicThreadAvailableForFollowUps({
  rows,
  thread,
}: {
  thread: FollowUpThreadRecord;
  rows: PublicThreadItemRow[];
}) {
  const initialItem = rows.find(
    (row) => row.questionId === thread.initialQuestionId,
  );

  return (
    thread.status === "published" &&
    thread.ownerIsActive &&
    thread.ownerUserDeletedAt === null &&
    initialItem !== undefined &&
    isVisiblePublishedItem(initialItem)
  );
}

function getThreadPublishedAt({
  rows,
  thread,
}: {
  thread: FollowUpThreadRecord;
  rows: PublicThreadItemRow[];
}) {
  const initialItem = rows.find(
    (row) => row.questionId === thread.initialQuestionId,
  );

  return thread.publishedAt ?? initialItem?.publishedAt ?? new Date(0);
}

function getVisiblePublishedItemCount(rows: PublicThreadItemRow[]) {
  return rows.filter(isVisiblePublishedItem).length;
}

function isVisiblePublishedItem(row: PublicThreadItemRow) {
  return row.itemStatus === "published" && row.itemDeletedAt === null;
}

function isAnswerItem(
  item: ReturnType<typeof createPublicThreadItems>[number],
): item is PublicThreadAnswerItem {
  return item.type === "answer";
}

function getPreviewItems(items: PublicThreadAnswerItem[]) {
  if (items.length <= 3) {
    return items;
  }

  const initialItem = items[0];

  if (initialItem === undefined) {
    return [];
  }

  const tailItems = items
    .slice(-2)
    .filter((item) => item.publicId !== initialItem.publicId);

  return [initialItem, ...tailItems];
}

function hasHoneypotValue(formData: FormData) {
  return (getFormText(formData, "website") ?? "").trim().length > 0;
}

function getFormText(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : undefined;
}

function isPublicQuestionIdentity(
  value: string | undefined,
): value is PublicQuestionIdentity {
  return publicQuestionIdentityValues.includes(value as PublicQuestionIdentity);
}

function normalizeQuestionTextForHash(text: string) {
  return text.replaceAll(/\s+/g, " ").trim().toLowerCase();
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function parseFollowUpTimingToken(token: string) {
  const unsealed = unsealJsonFromCookie(token, FOLLOW_UP_TIMING_TOKEN_PURPOSE);

  if (!isFollowUpTimingToken(unsealed)) {
    return undefined;
  }

  return unsealed;
}

function isFollowUpTimingToken(value: unknown): value is {
  profileId: string;
  username: string;
  threadPublicId: string;
  createdAt: number;
} {
  return (
    typeof value === "object" &&
    value !== null &&
    "profileId" in value &&
    "username" in value &&
    "threadPublicId" in value &&
    "createdAt" in value &&
    typeof value.profileId === "string" &&
    typeof value.username === "string" &&
    typeof value.threadPublicId === "string" &&
    typeof value.createdAt === "number"
  );
}

function isFollowUpFlashCookieValue(value: unknown): value is {
  username: string;
  threadPublicId: string;
  result: FollowUpFlash;
} {
  return (
    typeof value === "object" &&
    value !== null &&
    "username" in value &&
    "threadPublicId" in value &&
    "result" in value &&
    typeof value.username === "string" &&
    typeof value.threadPublicId === "string" &&
    isFollowUpFlash(value.result)
  );
}

function isFollowUpFlash(value: unknown): value is FollowUpFlash {
  if (typeof value !== "object" || value === null || !("status" in value)) {
    return false;
  }

  if (value.status === "success") {
    return "message" in value && typeof value.message === "string";
  }

  if (value.status === "error") {
    return "values" in value && isFollowUpFormValues(value.values);
  }

  return false;
}

function isFollowUpFormValues(value: unknown): value is FollowUpFormValues {
  return (
    typeof value === "object" &&
    value !== null &&
    "question" in value &&
    "identityMode" in value &&
    typeof value.question === "string" &&
    isPublicQuestionIdentity(
      typeof value.identityMode === "string" ? value.identityMode : undefined,
    )
  );
}

function serializeFollowUpFlashCookie(value: string, maxAgeSeconds: number) {
  const cookieParts = [
    `${FOLLOW_UP_FLASH_COOKIE_NAME}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${String(maxAgeSeconds)}`,
  ];

  if (serverEnv.NODE_ENV === "production") {
    cookieParts.push("Secure");
  }

  return cookieParts.join("; ");
}

function getCookieValue(cookieHeader: string | null, cookieName: string) {
  if (cookieHeader === null) {
    return undefined;
  }

  for (const cookie of cookieHeader.split(";")) {
    const [name, ...valueParts] = cookie.trim().split("=");

    if (name === cookieName) {
      return valueParts.join("=");
    }
  }

  return undefined;
}
