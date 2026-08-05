import { describe, expect, it } from "vitest";

import type { CompletedProfileSessionSummary } from "~/features/auth/services/auth.service.server";
import {
  loadInboxFolder,
  type InboxLoaderStore,
  type InboxFolder,
  type StoredInboxQuestion,
} from "~/features/inbox/queries/inbox.queries.server";

const now = new Date("2026-05-31T12:00:00.000Z");

describe("loadInboxFolder", () => {
  it("loads only non-deleted owner questions for the requested folder", async () => {
    const inbox = createInboxLoaderStore({
      questions: [
        createQuestion({
          id: "question_old",
          publicId: "qst_old",
          createdAt: new Date("2026-05-30T12:00:00.000Z"),
        }),
        createQuestion({
          id: "question_new",
          publicId: "qst_new",
          identityMode: "account_attributed",
          originalText: "Latest question",
          createdAt: new Date("2026-05-31T12:00:00.000Z"),
        }),
        createQuestion({
          id: "question_filtered",
          publicId: "qst_filtered",
          status: "filtered",
        }),
        createQuestion({
          id: "question_deleted",
          publicId: "qst_deleted",
          deletedAt: now,
        }),
        createQuestion({
          id: "question_other_user",
          publicId: "qst_other_user",
          recipientUserId: "user_other",
        }),
      ],
    });

    const folder = await loadInboxFolder({
      folder: "inbox",
      session: completedSession,
      store: inbox.store,
    });

    expect(inbox.calls).toEqual([
      {
        profileId: "profile_1",
        userId: "user_1",
        statuses: ["inbox"],
      },
    ]);
    expect(folder.questions).toEqual([
      {
        publicId: "qst_new",
        text: "Latest question",
        identity: "attributed",
        createdAt: "2026-05-31T12:00:00.000Z",
      },
      {
        publicId: "qst_old",
        text: "What should I read next?",
        identity: "anonymous",
        createdAt: "2026-05-30T12:00:00.000Z",
      },
    ]);
  });

  it("exposes public sender details for attributed questions only", async () => {
    const inbox = createInboxLoaderStore({
      questions: [
        createQuestion({
          publicId: "qst_attributed",
          identityMode: "account_attributed",
          askerDisplayName: "Asker",
          askerUsername: "asker",
          askerAvatarUrl: "https://example.test/avatar.png",
        }),
      ],
    });

    const folder = await loadInboxFolder({
      folder: "inbox",
      session: completedSession,
      store: inbox.store,
    });

    expect(folder.questions[0]?.sender).toEqual({
      displayName: "Asker",
      username: "asker",
      avatarUrl: "https://example.test/avatar.png",
    });
  });

  it("never exposes sender details for anonymous questions", async () => {
    const inbox = createInboxLoaderStore({
      questions: [
        // An account-anonymous asker: the row still carries profile columns,
        // but nothing about them may reach the view.
        createQuestion({
          publicId: "qst_account_anonymous",
          identityMode: "account_anonymous",
          askerDisplayName: "Asker",
          askerUsername: "asker",
          askerAvatarUrl: "https://example.test/avatar.png",
        }),
        createQuestion({
          publicId: "qst_guest_anonymous",
          identityMode: "guest_anonymous",
          createdAt: new Date("2026-05-30T12:00:00.000Z"),
        }),
      ],
    });

    const folder = await loadInboxFolder({
      folder: "inbox",
      session: completedSession,
      store: inbox.store,
    });

    for (const question of folder.questions) {
      expect(question.identity).toBe("anonymous");
      expect(question.sender).toBeUndefined();
      expect(JSON.stringify(question)).not.toContain("asker");
    }
  });

  it("derives a generated marker without exposing raw provenance", async () => {
    const inbox = createInboxLoaderStore({
      questions: [
        createQuestion({
          publicId: "qst_generated",
          source: "ai_generated",
        }),
      ],
    });

    const folder = await loadInboxFolder({
      folder: "inbox",
      session: completedSession,
      store: inbox.store,
    });

    expect(folder.questions[0]).toMatchObject({ generated: true });
    expect(JSON.stringify(folder.questions[0])).not.toContain("ai_generated");
    expect(JSON.stringify(folder.questions[0])).not.toMatch(/source|batch|model|token/iu);
  });
});

function createInboxLoaderStore({
  questions,
}: {
  questions: StoredInboxQuestion[];
}) {
  const calls: {
    profileId: string;
    userId: string;
    statuses: readonly InboxFolder[];
  }[] = [];
  const store: InboxLoaderStore = {
    findQuestionsForOwner(params) {
      calls.push(params);
      return Promise.resolve(questions);
    },
  };

  return {
    calls,
    store,
  };
}

function createQuestion(
  overrides: Partial<StoredInboxQuestion> = {},
): StoredInboxQuestion {
  return {
    id: "question_1",
    publicId: "qst_1",
    recipientProfileId: "profile_1",
    recipientUserId: "user_1",
    identityMode: "guest_anonymous",
    source: "public_profile",
    status: "inbox",
    originalText: "What should I read next?",
    deletedAt: null,
    createdAt: now,
    ...overrides,
  };
}

const completedSession = {
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
} satisfies CompletedProfileSessionSummary;
