import type { ZodError } from "zod";
import { and, eq, or, type SQL } from "drizzle-orm";

import { getRuntimeDatabase, type RuntimeDatabase } from "~/db/client.server";
import { blocks, mutedPhrases, questions } from "~/db/schema";
import type {
  CurrentSessionSummary
} from "~/features/auth/services/auth.service.server";;
import { normalizeMutedPhrase } from "~/features/moderation/validations/moderation.validations";
import {
  evaluateAskPermission,
  type QuestionIdentityMode,
} from "~/features/profiles/services/ask-permissions.service.server";
import {
  validateAskTimingToken,
  type AskTimingTokenDecision,
} from "~/features/profiles/services/ask-friction.service.server";
import {
  publicQuestionIdentityValues,
  publicQuestionSubmissionSchema,
  type PublicQuestionIdentity,
} from "~/features/profiles/validations/profile.validations";
import {
  resolvePublicProfile,
  createDrizzlePublicProfileStore,
  type PublicProfile,
  type PublicProfileStore,
} from "~/features/profiles/queries/profile.queries.server";
import { hashWithHmacSha256 } from "~/lib/crypto.server";
import { createDatabaseId, createPublicId } from "~/lib/ids.server";
import { checkRateLimit } from "~/lib/rate-limit.server";
import { getRequestInfoHashes } from "~/lib/request-info.server";
import { parseFormData } from "~/lib/zod-form";

export interface PublicQuestionFieldErrors {
  question?: string;
  identityMode?: string;
  timingToken?: string;
}

export interface PublicQuestionFormValues {
  question: string;
  identityMode: PublicQuestionIdentity;
}

export type PublicQuestionSubmissionResult =
  | {
      status: "created";
      values: PublicQuestionFormValues;
      identityMode: QuestionIdentityMode;
      questionPublicId: string;
    }
  | {
      status: "invalid";
      values: PublicQuestionFormValues;
      fieldErrors: PublicQuestionFieldErrors;
      formError?: string;
    }
  | {
      status: "denied";
      values: PublicQuestionFormValues;
      formError: string;
    }
  | {
      status: "rate_limited";
      values: PublicQuestionFormValues;
      retryAfterSeconds: number;
    }
  | {
      status: "dropped";
      values: PublicQuestionFormValues;
      reason: "honeypot" | "timing" | "safety";
      timing?: AskTimingTokenDecision;
    };

export interface NewPublicQuestion {
  id: string;
  publicId: string;
  recipientProfileId: string;
  recipientUserId: string;
  askerUserId: string | null;
  askerProfileId: string | null;
  identityMode: QuestionIdentityMode;
  source: "public_profile";
  status: "inbox" | "filtered";
  originalText: string;
  normalizedTextHash: string;
  ipHash: string | null;
  userAgentHash: string | null;
  safetyFingerprintHash: string;
  safetyMetadataRetainUntil: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicQuestionStore {
  createQuestion(question: NewPublicQuestion): Promise<void>;
}

export type QuestionSafetyDecision = "allow" | "filter" | "drop";

export interface PublicQuestionSafetyInput {
  text: string;
  identityMode: QuestionIdentityMode;
  targetProfileId: string;
  askerUserId: string | null;
  askerProfileId: string | null;
  safetyFingerprintHash: string;
  ipHash: string | null;
}

export interface PublicQuestionSafetyStore {
  findMatchingBlocks(
    input: Omit<PublicQuestionSafetyInput, "text" | "identityMode">,
  ): Promise<{ id: string }[]>;
  findMutedPhrasesForProfile(
    profileId: string,
  ): Promise<{ normalizedPhrase: string }[]>;
}

type RateLimitCheck = typeof checkRateLimit;

export async function submitPublicQuestion({
  createId = createDatabaseId,
  createQuestionPublicId = () => createPublicId("qst"),
  formData,
  minimumSubmitMilliseconds,
  now = new Date(),
  profileStore,
  rateLimiter = checkRateLimit,
  request,
  safetyDecider = decideQuestionSafety,
  session,
  store = createDrizzlePublicQuestionStore(),
  username,
}: {
  formData: FormData;
  request: Request;
  session: CurrentSessionSummary;
  username: string;
  profileStore?: PublicProfileStore | undefined;
  store?: PublicQuestionStore | undefined;
  rateLimiter?: RateLimitCheck | undefined;
  safetyDecider?: ((
    input: PublicQuestionSafetyInput,
  ) => Promise<QuestionSafetyDecision> | QuestionSafetyDecision) | undefined;
  createId?: (() => string) | undefined;
  createQuestionPublicId?: (() => string) | undefined;
  now?: Date | undefined;
  minimumSubmitMilliseconds?: number | undefined;
}): Promise<PublicQuestionSubmissionResult> {
  const values = getPublicQuestionFormValues(formData);

  if (
    session.status === "authenticated" &&
    session.profileStatus === "complete" &&
    session.profileActive === false
  ) {
    return {
      status: "denied",
      values,
      formError: "Questions are unavailable while your profile is deactivated.",
    };
  }

  const resolvedProfileStore = profileStore ?? createDrizzlePublicProfileStore();
  const resolution = await resolvePublicProfile({
    username,
    store: resolvedProfileStore,
    now,
  });

  if (resolution.status !== "active") {
    return {
      status: "denied",
      values,
      formError: "This profile is not available for questions.",
    };
  }

  const askPermissionTarget = await getAskPermissionTarget({
    profile: resolution.profile,
    session,
    store: resolvedProfileStore,
  });

  if (hasHoneypotValue(formData)) {
    return { status: "dropped", values, reason: "honeypot" };
  }

  const timing = validateAskTimingToken({
    token: getFormText(formData, "timingToken"),
    profileId: resolution.profile.id,
    username: resolution.profile.username,
    now,
    minimumSubmitMilliseconds,
  });

  if (timing.status === "invalid") {
    if (timing.reason === "expired") {
      return {
        status: "invalid",
        values,
        fieldErrors: {
          timingToken: "This question form expired. Try submitting it again.",
        },
        formError: "Your question was not sent. Please try again.",
      };
    }

    return { status: "dropped", values, reason: "timing", timing };
  }

  const parsed = parseFormData(publicQuestionSubmissionSchema, formData);

  if (!parsed.ok) {
    return {
      status: "invalid",
      values,
      fieldErrors: getQuestionFieldErrors(parsed.error),
    };
  }

  const permission = evaluateAskPermission({
    actor: session,
    identity: parsed.value.identityMode,
    target: askPermissionTarget,
  });

  if (permission.status === "denied") {
    return {
      status: "denied",
      values: getQuestionValues(parsed.value),
      formError: permission.message,
    };
  }

  const requestInfo = getRequestInfoHashes(request);
  const rateLimit = await checkPublicAskRateLimits({
    actor: session,
    profile: resolution.profile,
    rateLimiter,
    requestInfo,
    now,
  });

  if (!rateLimit.allowed) {
    return {
      status: "rate_limited",
      values: getQuestionValues(parsed.value),
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
    targetProfileId: resolution.profile.id,
    ...askerIdentity,
    safetyFingerprintHash: requestInfo.fingerprintHash,
    ipHash: requestInfo.ipHash,
  });

  if (safetyDecision === "drop") {
    return {
      status: "dropped",
      values: getQuestionValues(parsed.value),
      reason: "safety",
    };
  }

  const publicId = createQuestionPublicId();

  await store.createQuestion(
    createNewPublicQuestion({
      id: createId(),
      publicId,
      identityMode: permission.identityMode,
      profile: resolution.profile,
      requestInfo,
      session,
      status: safetyDecision === "filter" ? "filtered" : "inbox",
      text: parsed.value.question,
      now,
    }),
  );

  return {
    status: "created",
    values: getQuestionValues(parsed.value),
    identityMode: permission.identityMode,
    questionPublicId: publicId,
  };
}

async function getAskPermissionTarget({
  profile,
  session,
  store,
}: {
  profile: PublicProfile;
  session: CurrentSessionSummary;
  store: PublicProfileStore;
}) {
  if (
    profile.askPermission !== "followers" ||
    session.status !== "authenticated" ||
    session.profileStatus !== "complete"
  ) {
    return profile;
  }

  const isFollowedByActor = await store.findViewerFollow?.({
    profileId: profile.id,
    viewerProfileId: session.profile.id,
  });

  return {
    ...profile,
    isFollowedByActor: isFollowedByActor === true,
  };
}

export function getPublicAskFlashForResult({
  result,
  session,
}: {
  result: PublicQuestionSubmissionResult;
  session: CurrentSessionSummary;
}) {
  if (result.status === "rate_limited") {
    return {
      status: "error" as const,
      values: result.values,
      formError: `Too many questions. Try again in ${formatRetryAfter(result.retryAfterSeconds)}.`,
    };
  }

  if (result.status === "created" || result.status === "dropped") {
    const flash = {
      status: "success" as const,
      message: "Question sent.",
    };

    if (session.status === "anonymous") {
      return {
        ...flash,
        prompt: "Create an account to get notified if a question is answered.",
      };
    }

    return flash;
  }

  if (result.status === "denied") {
    return {
      status: "error" as const,
      values: result.values,
      formError: result.formError,
    };
  }

  return {
    status: "error" as const,
    values: result.values,
    fieldErrors: result.fieldErrors,
    formError: result.formError,
  };
}

function formatRetryAfter(retryAfterSeconds: number) {
  if (retryAfterSeconds <= 60) {
    return "1 minute";
  }

  const retryAfterMinutes = Math.ceil(retryAfterSeconds / 60);
  return `${String(retryAfterMinutes)} minutes`;
}

export function createDrizzlePublicQuestionStore(
  database: RuntimeDatabase = getRuntimeDatabase(),
): PublicQuestionStore {
  return {
    async createQuestion(question) {
      await database.insert(questions).values(question);
    },
  };
}

export async function decideQuestionSafety(
  input: PublicQuestionSafetyInput,
  store: PublicQuestionSafetyStore = createDrizzlePublicQuestionSafetyStore(),
): Promise<QuestionSafetyDecision> {
  const matchingBlocks = await store.findMatchingBlocks({
    targetProfileId: input.targetProfileId,
    askerUserId: input.askerUserId,
    askerProfileId: input.askerProfileId,
    safetyFingerprintHash: input.safetyFingerprintHash,
    ipHash: input.ipHash,
  });

  if (matchingBlocks.length > 0) {
    return "drop";
  }

  const muted = await store.findMutedPhrasesForProfile(input.targetProfileId);
  const normalizedText = normalizeMutedPhrase(input.text);

  return muted.some(
    (phrase) =>
      phrase.normalizedPhrase.length > 0 &&
      normalizedText.includes(phrase.normalizedPhrase),
  )
    ? "filter"
    : "allow";
}

export function createDrizzlePublicQuestionSafetyStore(
  database: RuntimeDatabase = getRuntimeDatabase(),
): PublicQuestionSafetyStore {
  return {
    async findMatchingBlocks(input) {
      const conditions: SQL[] = [
        eq(blocks.safetyFingerprintHash, input.safetyFingerprintHash),
      ];

      if (input.askerUserId !== null) {
        conditions.push(eq(blocks.blockedUserId, input.askerUserId));
      }

      if (input.askerProfileId !== null) {
        conditions.push(eq(blocks.blockedProfileId, input.askerProfileId));
      }

      if (input.ipHash !== null) {
        conditions.push(eq(blocks.ipHash, input.ipHash));
      }

      const rows = await database
        .select({ id: blocks.id })
        .from(blocks)
        .where(
          and(
            eq(blocks.ownerProfileId, input.targetProfileId),
            or(...conditions),
          ),
        )
        .limit(1);

      return rows;
    },
    async findMutedPhrasesForProfile(profileId) {
      return database
        .select({ normalizedPhrase: mutedPhrases.normalizedPhrase })
        .from(mutedPhrases)
        .where(eq(mutedPhrases.profileId, profileId));
    },
  };
}

async function checkPublicAskRateLimits({
  actor,
  now,
  profile,
  rateLimiter,
  requestInfo,
}: {
  actor: CurrentSessionSummary;
  profile: PublicProfile;
  rateLimiter: RateLimitCheck;
  requestInfo: ReturnType<typeof getRequestInfoHashes>;
  now: Date;
}) {
  const decisions = await Promise.all(
    getRateLimitChecks({ actor, profile, requestInfo }).map((key) =>
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

function getRateLimitChecks({
  actor,
  profile,
  requestInfo,
}: {
  actor: CurrentSessionSummary;
  profile: PublicProfile;
  requestInfo: ReturnType<typeof getRequestInfoHashes>;
}) {
  if (actor.status === "anonymous") {
    return [
      {
        key: `ask:guest:recipient-hour:${profile.id}:${requestInfo.fingerprintHash}`,
        max: 5,
        windowSeconds: 60 * 60,
      },
      {
        key: `ask:guest:recipient-day:${profile.id}:${requestInfo.fingerprintHash}`,
        max: 20,
        windowSeconds: 24 * 60 * 60,
      },
      {
        key: `ask:guest:global-day:${requestInfo.fingerprintHash}`,
        max: 30,
        windowSeconds: 24 * 60 * 60,
      },
    ];
  }

  return [
    {
      key: `ask:account:day:${actor.user.id}`,
      max: 20,
      windowSeconds: 24 * 60 * 60,
    },
    {
      key: `ask:account:recipient-day:${actor.user.id}:${profile.id}`,
      max: 10,
      windowSeconds: 24 * 60 * 60,
    },
  ];
}

function createNewPublicQuestion({
  id,
  identityMode,
  now,
  profile,
  publicId,
  requestInfo,
  session,
  status,
  text,
}: {
  id: string;
  publicId: string;
  profile: PublicProfile;
  session: CurrentSessionSummary;
  identityMode: QuestionIdentityMode;
  status: "inbox" | "filtered";
  text: string;
  requestInfo: ReturnType<typeof getRequestInfoHashes>;
  now: Date;
}): NewPublicQuestion {
  return {
    id,
    publicId,
    recipientProfileId: profile.id,
    recipientUserId: profile.userId,
    ...getAskerIdentityFields({ identityMode, session }),
    identityMode,
    source: "public_profile",
    status,
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
}): Pick<NewPublicQuestion, "askerUserId" | "askerProfileId"> {
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

function getPublicQuestionFormValues(
  formData: FormData,
): PublicQuestionFormValues {
  const identityMode = getFormText(formData, "identityMode");

  return {
    question: getFormText(formData, "question")?.trim() ?? "",
    identityMode: isPublicQuestionIdentity(identityMode)
      ? identityMode
      : "anonymous",
  };
}

function getQuestionValues(submission: {
  question: string;
  identityMode: PublicQuestionIdentity;
}): PublicQuestionFormValues {
  return {
    question: submission.question,
    identityMode: submission.identityMode,
  };
}

function getQuestionFieldErrors(error: ZodError): PublicQuestionFieldErrors {
  const fieldErrors: PublicQuestionFieldErrors = {};

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
