import { describe, expect, it } from "vitest";

import type { CurrentSessionSummary } from "~/features/auth/auth.server";
import {
  createAskTimingToken,
} from "~/features/profiles/ask-friction.server";
import {
  decideQuestionSafety,
  submitPublicQuestion,
  type NewPublicQuestion,
  type PublicQuestionSafetyInput,
  type PublicQuestionSafetyStore,
  type PublicQuestionStore,
} from "~/features/profiles/ask-question.action.server";
import type { PublicQuestionIdentity } from "~/features/profiles/profile.schema";
import type {
  PublicProfile,
  PublicProfileStore,
  PublicUsernameReservation,
} from "~/features/profiles/profile.loader.server";
import type {
  RateLimitDecision,
  RateLimitOptions,
} from "~/lib/rate-limit.server";

const now = new Date("2026-05-31T12:00:00.000Z");

describe("submitPublicQuestion", () => {
  it("returns field errors for invalid question text", async () => {
    const questions = createQuestionStore();

    const result = await submitQuestion({
      formData: createQuestionFormData({ question: "" }),
      questionStore: questions.store,
    });

    expect(result).toMatchObject({
      status: "invalid",
      fieldErrors: {
        question: "Enter a question.",
      },
    });
    expect(questions.created).toEqual([]);
  });

  it("drops honeypot submissions with generic success semantics", async () => {
    const questions = createQuestionStore();

    const result = await submitQuestion({
      formData: createQuestionFormData({ website: "https://bot.example" }),
      questionStore: questions.store,
    });

    expect(result).toMatchObject({
      status: "dropped",
      reason: "honeypot",
    });
    expect(questions.created).toEqual([]);
  });

  it("drops missing or too-fast timing tokens", async () => {
    const questions = createQuestionStore();

    await expect(
      submitQuestion({
        formData: createQuestionFormData({ timingToken: "" }),
        questionStore: questions.store,
      }),
    ).resolves.toMatchObject({
      status: "dropped",
      reason: "timing",
      timing: {
        reason: "missing",
      },
    });

    await expect(
      submitQuestion({
        formData: createQuestionFormData({
          timingToken: createAskTimingToken({
            profileId: "profile_1",
            username: "person",
            now,
          }),
        }),
        questionStore: questions.store,
      }),
    ).resolves.toMatchObject({
      status: "dropped",
      reason: "timing",
      timing: {
        reason: "too_fast",
      },
    });

    expect(questions.created).toEqual([]);
  });

  it("drops rate-limited submissions without creating questions", async () => {
    const questions = createQuestionStore();

    const result = await submitQuestion({
      questionStore: questions.store,
      rateLimiter: () => Promise.resolve({
        allowed: false,
        retryAfterSeconds: 60,
      }),
    });

    expect(result).toMatchObject({
      status: "dropped",
      reason: "rate_limited",
    });
    expect(questions.created).toEqual([]);
  });

  it("denies anonymous-disabled guest asks without creating questions", async () => {
    const questions = createQuestionStore();

    const result = await submitQuestion({
      profile: createProfile({ anonymousQuestionsEnabled: false }),
      questionStore: questions.store,
    });

    expect(result).toMatchObject({
      status: "denied",
      formError: "This profile only accepts questions from signed-in profiles.",
    });
    expect(questions.created).toEqual([]);
  });

  it.each([
    {
      label: "guest anonymous",
      identityMode: "anonymous",
      session: anonymousSession,
      expected: {
        identityMode: "guest_anonymous",
        askerUserId: null,
        askerProfileId: null,
      },
    },
    {
      label: "logged-in anonymous",
      identityMode: "anonymous",
      session: completedSession,
      expected: {
        identityMode: "account_anonymous",
        askerUserId: "user_2",
        askerProfileId: null,
      },
    },
    {
      label: "logged-in attributed",
      identityMode: "attributed",
      session: completedSession,
      expected: {
        identityMode: "account_attributed",
        askerUserId: "user_2",
        askerProfileId: "profile_2",
      },
    },
  ] as const)("creates $label questions in the inbox", async (caseData) => {
    const questions = createQuestionStore();

    const result = await submitQuestion({
      formData: createQuestionFormData({
        identityMode: caseData.identityMode,
        question: " What should I read next? ",
      }),
      questionStore: questions.store,
      session: caseData.session,
    });

    expect(result).toMatchObject({
      status: "created",
      identityMode: caseData.expected.identityMode,
      questionPublicId: "question_public_1",
    });
    expect(questions.created).toHaveLength(1);
    expect(questions.created[0]).toMatchObject({
      id: "question_1",
      publicId: "question_public_1",
      recipientProfileId: "profile_1",
      recipientUserId: "user_1",
      source: "public_profile",
      status: "inbox",
      originalText: "What should I read next?",
      ...caseData.expected,
    });
    expect(questions.created[0]?.normalizedTextHash).toEqual(expect.any(String));
    expect(questions.created[0]?.safetyFingerprintHash).toEqual(expect.any(String));
    expect(questions.created[0]?.safetyMetadataRetainUntil.toISOString()).toBe(
      "2026-06-30T12:00:00.000Z",
    );
  });

  it("uses the safety hook to filter or drop questions generically", async () => {
    const filteredQuestions = createQuestionStore();

    await expect(
      submitQuestion({
        questionStore: filteredQuestions.store,
        safetyDecider: () => "filter",
      }),
    ).resolves.toMatchObject({
      status: "created",
    });
    expect(filteredQuestions.created[0]?.status).toBe("filtered");

    const droppedQuestions = createQuestionStore();

    await expect(
      submitQuestion({
        questionStore: droppedQuestions.store,
        safetyDecider: () => "drop",
      }),
    ).resolves.toMatchObject({
      status: "dropped",
      reason: "safety",
    });
    expect(droppedQuestions.created).toEqual([]);
  });

  it("passes account sender ids to the safety hook when available", async () => {
    let safetyInput: PublicQuestionSafetyInput | undefined;

    await submitQuestion({
      formData: createQuestionFormData({ identityMode: "attributed" }),
      safetyDecider: (input) => {
        safetyInput = input;
        return "allow";
      },
      session: completedSession,
    });

    expect(safetyInput).toBeDefined();

    if (safetyInput === undefined) {
      throw new Error("expected safety input");
    }

    expect(safetyInput).toMatchObject({
      askerUserId: "user_2",
      askerProfileId: "profile_2",
      identityMode: "account_attributed",
      targetProfileId: "profile_1",
    });
    expect(safetyInput.ipHash).toEqual(expect.any(String));
    expect(safetyInput.safetyFingerprintHash).toEqual(expect.any(String));
  });

  it("drops blocked senders with generic success semantics", async () => {
    const questions = createQuestionStore();
    const safetyStore = createSafetyStore({
      matchingBlocks: [{ id: "block_1" }],
    });

    await expect(
      submitQuestion({
        questionStore: questions.store,
        safetyDecider: (input) => decideQuestionSafety(input, safetyStore.store),
      }),
    ).resolves.toMatchObject({
      status: "dropped",
      reason: "safety",
    });
    expect(questions.created).toEqual([]);
  });

  it("filters muted phrase matches", async () => {
    const questions = createQuestionStore();
    const safetyStore = createSafetyStore({
      mutedPhrases: [{ normalizedPhrase: "مزعج جدا" }],
    });

    await expect(
      submitQuestion({
        formData: createQuestionFormData({ question: "هذا سؤال مزعج   جدا" }),
        questionStore: questions.store,
        safetyDecider: (input) => decideQuestionSafety(input, safetyStore.store),
      }),
    ).resolves.toMatchObject({
      status: "created",
    });
    expect(questions.created[0]?.status).toBe("filtered");
  });
});

describe("decideQuestionSafety", () => {
  it("checks owner blocks before muted phrases", async () => {
    const safetyStore = createSafetyStore({
      matchingBlocks: [{ id: "block_1" }],
      mutedPhrases: [{ normalizedPhrase: "blocked text" }],
    });

    await expect(
      decideQuestionSafety(createSafetyInput(), safetyStore.store),
    ).resolves.toBe("drop");
    expect(safetyStore.mutedPhraseLookups).toEqual([]);
  });
});

async function submitQuestion({
  formData = createQuestionFormData(),
  profile = createProfile(),
  questionStore = createQuestionStore().store,
  rateLimiter = () => Promise.resolve({ allowed: true }),
  safetyDecider,
  session = anonymousSession,
}: {
  formData?: FormData;
  profile?: PublicProfile;
  questionStore?: PublicQuestionStore;
  rateLimiter?: (options: RateLimitOptions) => Promise<RateLimitDecision>;
  safetyDecider?: Parameters<typeof submitPublicQuestion>[0]["safetyDecider"];
  session?: CurrentSessionSummary;
} = {}) {
  return submitPublicQuestion({
    createId: createIdSequence(["question_1"]),
    createQuestionPublicId: () => "question_public_1",
    formData,
    now,
    profileStore: createProfileStore({ profiles: [profile] }),
    rateLimiter,
    request: createRequest(),
    safetyDecider: safetyDecider ?? (() => "allow"),
    session,
    store: questionStore,
    username: "person",
  });
}

function createQuestionFormData(
  values: Partial<{
    question: string;
    identityMode: PublicQuestionIdentity;
    timingToken: string;
    website: string;
  }> = {},
) {
  const formData = new FormData();

  formData.set("question", values.question ?? "What should I read next?");
  formData.set("identityMode", values.identityMode ?? "anonymous");
  formData.set(
    "timingToken",
    values.timingToken ??
      createAskTimingToken({
        profileId: "profile_1",
        username: "person",
        now: new Date(now.getTime() - 2_000),
      }),
  );

  if (values.website !== undefined) {
    formData.set("website", values.website);
  }

  return formData;
}

function createProfileStore({
  profiles = [],
  reservations = [],
}: {
  profiles?: PublicProfile[];
  reservations?: PublicUsernameReservation[];
}): PublicProfileStore {
  return {
    findProfileByUsername(username) {
      return Promise.resolve(
        profiles.find((profile) => profile.username === username),
      );
    },
    findUsernameReservation(username) {
      return Promise.resolve(
        reservations.find((reservation) => reservation.username === username),
      );
    },
  };
}

function createQuestionStore() {
  const created: NewPublicQuestion[] = [];
  const store: PublicQuestionStore = {
    createQuestion(question) {
      created.push(question);
      return Promise.resolve();
    },
  };

  return {
    created,
    store,
  };
}

function createSafetyStore({
  matchingBlocks = [],
  mutedPhrases = [],
}: {
  matchingBlocks?: { id: string }[];
  mutedPhrases?: { normalizedPhrase: string }[];
} = {}) {
  const blockLookups: Omit<PublicQuestionSafetyInput, "text" | "identityMode">[] =
    [];
  const mutedPhraseLookups: string[] = [];
  const store: PublicQuestionSafetyStore = {
    findMatchingBlocks(input) {
      blockLookups.push(input);
      return Promise.resolve(matchingBlocks);
    },
    findMutedPhrasesForProfile(profileId) {
      mutedPhraseLookups.push(profileId);
      return Promise.resolve(mutedPhrases);
    },
  };

  return {
    blockLookups,
    mutedPhraseLookups,
    store,
  };
}

function createSafetyInput(
  overrides: Partial<PublicQuestionSafetyInput> = {},
): PublicQuestionSafetyInput {
  return {
    text: "What should I read next?",
    identityMode: "guest_anonymous",
    targetProfileId: "profile_1",
    askerUserId: null,
    askerProfileId: null,
    safetyFingerprintHash: "fingerprint_hash_1",
    ipHash: "ip_hash_1",
    ...overrides,
  };
}

function createProfile(overrides: Partial<PublicProfile> = {}): PublicProfile {
  return {
    id: "profile_1",
    userId: "user_1",
    username: "person",
    displayName: "Person",
    avatarUrl: null,
    bio: null,
    isActive: true,
    acceptingQuestions: true,
    anonymousQuestionsEnabled: true,
    askPermission: "everyone",
    showFollowerCounts: true,
    showLikeCounts: true,
    userDeletedAt: null,
    ...overrides,
  };
}

function createRequest() {
  return new Request("https://app.example.com/person/questions", {
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
