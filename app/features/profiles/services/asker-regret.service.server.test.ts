import { describe, expect, it } from "vitest";

import type {
  AuthenticatedSessionSummary
} from "~/features/auth/services/auth.service.server";;
import {
  anonymizeOwnQuestion,
  deleteOwnQuestion,
  type AskerRegretStore,
  type RegretQuestion,
} from "~/features/profiles/services/asker-regret.service.server";

const now = new Date("2026-05-31T12:00:00.000Z");

describe("anonymizeOwnQuestion", () => {
  it("anonymizes an attributed own inbox question", async () => {
    const regret = createRegretStore({
      question: createQuestion({ identityMode: "account_attributed" }),
    });

    const result = await anonymizeOwnQuestion({
      publicId: "qst_1",
      session: completedSession,
      store: regret.store,
      now,
    });

    expect(result).toEqual({ status: "updated" });
    expect(regret.anonymized).toEqual([{ questionId: "question_1", now }]);
  });

  it("denies anonymous, other-user, closed, deleted, and suspended cases", async () => {
    await expect(
      anonymizeOwnQuestion({
        publicId: "qst_1",
        session: completedSession,
        store: createRegretStore({
          question: createQuestion({ identityMode: "account_anonymous" }),
        }).store,
        now,
      }),
    ).resolves.toEqual({ status: "denied", reason: "not_attributed" });

    await expect(
      anonymizeOwnQuestion({
        publicId: "qst_1",
        session: completedSession,
        store: createRegretStore({
          question: createQuestion({ askerUserId: "user_other" }),
        }).store,
        now,
      }),
    ).resolves.toEqual({ status: "denied", reason: "not_owner" });

    await expect(
      anonymizeOwnQuestion({
        publicId: "qst_1",
        session: completedSession,
        store: createRegretStore({
          question: createQuestion({ status: "draft" }),
        }).store,
        now,
      }),
    ).resolves.toEqual({ status: "denied", reason: "closed" });

    await expect(
      anonymizeOwnQuestion({
        publicId: "qst_1",
        session: completedSession,
        store: createRegretStore({
          question: createQuestion({ deletedAt: now }),
        }).store,
        now,
      }),
    ).resolves.toEqual({ status: "denied", reason: "already_deleted" });

    await expect(
      anonymizeOwnQuestion({
        publicId: "qst_1",
        session: { ...completedSession, suspensionStatus: "active" },
        store: createRegretStore({ question: createQuestion() }).store,
        now,
      }),
    ).resolves.toEqual({ status: "denied", reason: "suspended" });
  });

  it("does not report success when the question closes before the update", async () => {
    const regret = createRegretStore({
      mutationAllowed: false,
      question: createQuestion({ identityMode: "account_attributed" }),
    });

    await expect(
      anonymizeOwnQuestion({
        publicId: "qst_1",
        session: completedSession,
        store: regret.store,
        now,
      }),
    ).resolves.toEqual({ status: "denied", reason: "closed" });
  });
});

describe("deleteOwnQuestion", () => {
  it("soft-deletes an own filtered question", async () => {
    const regret = createRegretStore({
      question: createQuestion({ status: "filtered" }),
    });

    const result = await deleteOwnQuestion({
      publicId: "qst_1",
      session: completedSession,
      store: regret.store,
      now,
    });

    expect(result).toEqual({ status: "updated" });
    expect(regret.deleted).toEqual([{ questionId: "question_1", now }]);
  });

  it("denies draft and answered questions", async () => {
    await expect(
      deleteOwnQuestion({
        publicId: "qst_1",
        session: completedSession,
        store: createRegretStore({
          question: createQuestion({ status: "draft" }),
        }).store,
        now,
      }),
    ).resolves.toEqual({ status: "denied", reason: "closed" });

    await expect(
      deleteOwnQuestion({
        publicId: "qst_1",
        session: completedSession,
        store: createRegretStore({
          question: createQuestion({ status: "answered" }),
        }).store,
        now,
      }),
    ).resolves.toEqual({ status: "denied", reason: "closed" });
  });

  it("does not report success when the question closes before deletion", async () => {
    const regret = createRegretStore({
      mutationAllowed: false,
      question: createQuestion(),
    });

    await expect(
      deleteOwnQuestion({
        publicId: "qst_1",
        session: completedSession,
        store: regret.store,
        now,
      }),
    ).resolves.toEqual({ status: "denied", reason: "closed" });
  });
});

function createRegretStore({
  mutationAllowed = true,
  question,
}: {
  mutationAllowed?: boolean;
  question?: RegretQuestion;
} = {}) {
  const anonymized: { questionId: string; now: Date }[] = [];
  const deleted: { questionId: string; now: Date }[] = [];
  const store: AskerRegretStore = {
    findQuestionForRegret(publicId) {
      return Promise.resolve(
        question?.publicId === publicId ? question : undefined,
      );
    },
    anonymizeQuestion(questionId, updatedAt) {
      anonymized.push({ questionId, now: updatedAt });
      return Promise.resolve(mutationAllowed);
    },
    deleteQuestionByAsker(questionId, deletedAt) {
      deleted.push({ questionId, now: deletedAt });
      return Promise.resolve(mutationAllowed);
    },
  };

  return {
    anonymized,
    deleted,
    store,
  };
}

function createQuestion(overrides: Partial<RegretQuestion> = {}): RegretQuestion {
  return {
    id: "question_1",
    publicId: "qst_1",
    askerUserId: "user_2",
    identityMode: "account_attributed",
    status: "inbox",
    deletedAt: null,
    ...overrides,
  };
}

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
} satisfies AuthenticatedSessionSummary;
