import { describe, expect, it } from "vitest";

import type {
  CurrentSessionSummary
} from "~/features/auth/services/auth.service.server";;
import { ASK_TIMING_TOKEN_MAX_AGE_MILLISECONDS } from "~/features/profiles/services/ask-friction.service.server";
import {
  createFollowUpTimingToken,
  getFollowUpFlashForResult,
  loadFollowUpPage,
  submitThreadFollowUp,
  type FollowUpStore,
  type FollowUpThreadRecord,
  type NewFollowUpNotification,
  type NewFollowUpQuestion
} from "~/features/threads/services/follow-up.service.server";;
import type {
  PublicThreadItemRow
} from "~/features/threads/queries/public-thread.queries.server";;
import type {
  RateLimitDecision,
  RateLimitOptions,
} from "~/lib/rate-limit.server";

const now = new Date("2026-05-31T12:00:00.000Z");

describe("loadFollowUpPage", () => {
  it("resolves by immutable public ID and redirects stale usernames", async () => {
    const result = await loadFollowUpPage({
      session: anonymousSession,
      store: createFollowUpStore({
        threads: [createThread({ publicId: "thr_immutable" })],
      }).store,
      threadPublicId: "thr_immutable",
      username: "old-person",
    });

    expect(result).toEqual({
      status: "redirect",
      username: "person",
    });
  });

  it("returns generic unavailable data for hidden threads", async () => {
    await expect(
      loadFollowUpPage({
        session: anonymousSession,
        store: createFollowUpStore({
          threads: [createThread({ status: "unpublished" })],
        }).store,
        threadPublicId: "thr_1",
        username: "person",
      }),
    ).resolves.toMatchObject({
      status: "page",
      responseStatus: 200,
      page: { status: "unavailable" },
    });
  });

  it("does not reveal a renamed owner for hidden follow-up pages", async () => {
    const store = createFollowUpStore({
      threads: [createThread({ status: "deleted" })],
    });

    const result = await loadFollowUpPage({
      session: anonymousSession,
      store: store.store,
      threadPublicId: "thr_1",
      username: "old-person",
    });

    expect(result).toEqual({
      status: "page",
      responseStatus: 200,
      page: {
        status: "unavailable",
        username: "old-person",
        threadPublicId: "thr_1",
      },
    });
    await expect(
      submitThreadFollowUp({
        formData: createFollowUpFormData(),
        now,
        request: createRequest(),
        session: anonymousSession,
        store: store.store,
        threadPublicId: "thr_1",
        username: "old-person",
      }),
    ).resolves.toMatchObject({
      status: "denied",
      formError: "This thread is unavailable for follow-ups.",
    });
  });
});

describe("submitThreadFollowUp", () => {
  it("returns validation errors without creating a follow-up question", async () => {
    const followUps = createFollowUpStore();

    const result = await submitFollowUp({
      followUpStore: followUps.store,
      formData: createFollowUpFormData({ question: "" }),
    });

    expect(result).toMatchObject({
      status: "invalid",
      fieldErrors: {
        question: "Enter a question.",
      },
    });
    expect(followUps.created).toEqual([]);
  });

  it("preserves follow-up text and returns an error for an expired timing token", async () => {
    const followUps = createFollowUpStore();
    const result = await submitFollowUp({
      followUpStore: followUps.store,
      formData: createFollowUpFormData({
        question: "Please keep this follow-up",
        timingToken: createFollowUpTimingToken({
          profileId: "profile_1",
          threadPublicId: "thr_1",
          username: "person",
          now: new Date(now.getTime() - ASK_TIMING_TOKEN_MAX_AGE_MILLISECONDS - 1),
        }),
      }),
    });

    expect(result).toMatchObject({
      status: "invalid",
      values: { question: "Please keep this follow-up" },
      formError: "Your follow-up was not sent. Please try again.",
    });
    expect(getFollowUpFlashForResult({ result, session: anonymousSession })).toMatchObject({
      status: "error",
      values: { question: "Please keep this follow-up" },
    });
    expect(followUps.created).toEqual([]);
  });

  it("creates inbox follow-ups linked to the thread and notifies the owner", async () => {
    const followUps = createFollowUpStore();

    const result = await submitFollowUp({
      followUpStore: followUps.store,
      formData: createFollowUpFormData({
        identityMode: "attributed",
        question: " Can you say more? ",
      }),
      session: completedSession,
    });

    expect(result).toMatchObject({
      status: "created",
      identityMode: "account_attributed",
      questionPublicId: "question_public_1",
    });
    expect(followUps.created).toHaveLength(1);
    expect(followUps.created[0]).toMatchObject({
      id: "question_1",
      publicId: "question_public_1",
      recipientProfileId: "profile_1",
      recipientUserId: "user_1",
      askerUserId: "user_2",
      askerProfileId: "profile_2",
      identityMode: "account_attributed",
      source: "public_profile",
      status: "inbox",
      threadId: "thread_1",
      originalText: "Can you say more?",
    });
    expect(followUps.notifications).toEqual([
      {
        id: "notification_1",
        recipientUserId: "user_1",
        type: "follow_up_asked",
        actorUserId: "user_2",
        threadId: "thread_1",
        threadItemId: null,
        questionId: "question_1",
        readAt: null,
        createdAt: now,
        expiresAt: new Date("2026-11-27T12:00:00.000Z"),
      },
    ]);
  });

  it("creates filtered follow-ups and still notifies the owner", async () => {
    const followUps = createFollowUpStore();

    await submitFollowUp({
      followUpStore: followUps.store,
      safetyDecider: () => "filter",
    });

    expect(followUps.created[0]?.status).toBe("filtered");
    expect(followUps.notifications).toHaveLength(1);
  });

  it("drops blocked senders and rejects rate-limited senders", async () => {
    const blocked = createFollowUpStore();

    await expect(
      submitFollowUp({
        followUpStore: blocked.store,
        safetyDecider: () => "drop",
      }),
    ).resolves.toMatchObject({
      status: "dropped",
      reason: "safety",
    });
    expect(blocked.created).toEqual([]);
    expect(blocked.notifications).toEqual([]);

    const limited = createFollowUpStore();

    await expect(
      submitFollowUp({
        followUpStore: limited.store,
        rateLimiter: () =>
          Promise.resolve({ allowed: false, retryAfterSeconds: 60 }),
      }),
    ).resolves.toMatchObject({
      status: "rate_limited",
      retryAfterSeconds: 60,
    });
    expect(limited.created).toEqual([]);
    expect(limited.notifications).toEqual([]);
  });

  it("returns an error flash for rate-limited follow-ups", async () => {
    const result = await submitFollowUp({
      rateLimiter: () =>
        Promise.resolve({ allowed: false, retryAfterSeconds: 60 }),
    });

    expect(
      getFollowUpFlashForResult({ result, session: anonymousSession }),
    ).toEqual({
      status: "error",
      values: {
        question: "Can you say more?",
        identityMode: "anonymous",
      },
      formError: "Too many follow-ups. Try again in 1 minute.",
    });
  });

  it("does not notify the owner for self follow-ups", async () => {
    const followUps = createFollowUpStore();

    await submitFollowUp({
      followUpStore: followUps.store,
      formData: createFollowUpFormData({ identityMode: "attributed" }),
      session: ownerSession,
    });

    expect(followUps.created).toHaveLength(1);
    expect(followUps.notifications).toEqual([]);
  });

  it("returns generic unavailable handling without creating questions", async () => {
    const followUps = createFollowUpStore({
      threads: [createThread({ status: "deleted" })],
    });

    await expect(
      submitFollowUp({
        followUpStore: followUps.store,
      }),
    ).resolves.toMatchObject({
      status: "denied",
      formError: "This thread is unavailable for follow-ups.",
    });
    expect(followUps.created).toEqual([]);
  });
});

async function submitFollowUp({
  followUpStore = createFollowUpStore().store,
  formData = createFollowUpFormData(),
  rateLimiter = () => Promise.resolve({ allowed: true }),
  safetyDecider = () => "allow" as const,
  session = anonymousSession,
}: {
  followUpStore?: FollowUpStore;
  formData?: FormData;
  rateLimiter?: (options: RateLimitOptions) => Promise<RateLimitDecision>;
  safetyDecider?: Parameters<typeof submitThreadFollowUp>[0]["safetyDecider"];
  session?: CurrentSessionSummary;
} = {}) {
  return submitThreadFollowUp({
    createId: createIdSequence(["question_1"]),
    createNotificationId: createIdSequence(["notification_1"]),
    createQuestionPublicId: () => "question_public_1",
    formData,
    now,
    rateLimiter,
    request: createRequest(),
    safetyDecider,
    session,
    store: followUpStore,
    threadPublicId: "thr_1",
    username: "person",
  }).then((result) => {
    if (result.status === "redirect") {
      throw new Error("expected follow-up submission result");
    }

    return result;
  });
}

function createFollowUpFormData(
  values: Partial<{
    question: string;
    identityMode: "anonymous" | "attributed";
    timingToken: string;
  }> = {},
) {
  const formData = new FormData();

  formData.set("question", values.question ?? "Can you say more?");
  formData.set("identityMode", values.identityMode ?? "anonymous");
  formData.set(
    "timingToken",
    values.timingToken ??
      createFollowUpTimingToken({
        now: new Date(now.getTime() - 2_000),
        profileId: "profile_1",
        threadPublicId: "thr_1",
        username: "person",
      }),
  );

  return formData;
}

function createFollowUpStore({
  rows = [createItem()],
  threads = [createThread()],
}: {
  rows?: PublicThreadItemRow[];
  threads?: FollowUpThreadRecord[];
} = {}) {
  const created: NewFollowUpQuestion[] = [];
  const notifications: NewFollowUpNotification[] = [];
  const store: FollowUpStore = {
    findThreadByPublicId(threadPublicId) {
      return Promise.resolve(
        threads.find((thread) => thread.publicId === threadPublicId),
      );
    },
    findThreadItems(threadId) {
      const thread = threads.find((candidate) => candidate.id === threadId);

      return Promise.resolve(thread === undefined ? [] : rows);
    },
    createFollowUpQuestion({ notification, question }) {
      created.push(question);

      if (notification !== undefined) {
        notifications.push(notification);
      }

      return Promise.resolve();
    },
  };

  return {
    created,
    notifications,
    store,
  };
}

function createThread(
  overrides: Partial<FollowUpThreadRecord> = {},
): FollowUpThreadRecord {
  return {
    id: "thread_1",
    publicId: "thr_1",
    status: "published",
    ownerProfileId: "profile_1",
    ownerUserId: "user_1",
    ownerUsername: "person",
    ownerDisplayName: "Person",
    ownerAvatarUrl: null,
    ownerIsActive: true,
    ownerUserDeletedAt: null,
    anonymousQuestionsEnabled: true,
    followUpPermissionDefault: "anyone",
    followUpPermissionOverride: null,
    followUpsEnabled: true,
    initialQuestionId: "question_initial",
    initialQuestionAskerUserId: "user_initial",
    publishedAt: now,
    ...overrides,
  };
}

function createItem(
  overrides: Partial<PublicThreadItemRow> = {},
): PublicThreadItemRow {
  return {
    publicId: "titem_initial",
    questionId: "question_initial",
    answerText: "Published answer",
    itemStatus: "published",
    itemDeletedAt: null,
    publishedAt: now,
    createdAt: now,
    position: 0,
    pinPosition: null,
    questionStatus: "answered",
    questionDeletedAt: null,
    questionTextMode: "original",
    displayQuestionText: "What should I read next?",
    identityMode: "guest_anonymous",
    askerDisplayName: null,
    askerUsername: null,
    ...overrides,
  };
}

function createRequest() {
  return new Request("https://app.example.com/person/a/thr_1/follow-ups", {
    headers: {
      "user-agent": "vitest",
      "x-forwarded-for": "203.0.113.1",
    },
  });
}

function createIdSequence(ids: string[]) {
  return () => ids.shift() ?? "extra_id";
}

const anonymousSession = {
  status: "anonymous",
} satisfies CurrentSessionSummary;

const completedSession = {
  status: "authenticated",
  profileStatus: "complete",
  suspensionStatus: "none",
  user: {
    id: "user_2",
    email: "asker@example.com",
    name: "Asker",
    image: undefined,
  },
  profile: {
    id: "profile_2",
    username: "asker",
    displayName: "Asker",
    avatarUrl: null,
  },
} satisfies CurrentSessionSummary;

const ownerSession = {
  status: "authenticated",
  profileStatus: "complete",
  suspensionStatus: "none",
  user: {
    id: "user_1",
    email: "person@example.com",
    name: "Person",
    image: undefined,
  },
  profile: {
    id: "profile_1",
    username: "person",
    displayName: "Person",
    avatarUrl: null,
  },
} satisfies CurrentSessionSummary;
