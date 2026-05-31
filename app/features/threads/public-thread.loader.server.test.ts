import { describe, expect, it } from "vitest";

import type { CompletedProfileSessionSummary } from "~/features/auth/auth.server";
import {
  loadPublicThreadPage,
  type PublicThreadItemRow,
  type PublicThreadRecord,
  type PublicThreadStore,
} from "~/features/threads/public-thread.loader.server";

const now = new Date("2026-05-31T12:00:00.000Z");

describe("loadPublicThreadPage", () => {
  it("resolves by immutable thread public ID and redirects stale usernames", async () => {
    const store = createThreadStore({
      threads: [createThread({ publicId: "thr_immutable" })],
    });

    const result = await loadPublicThreadPage({
      session: anonymousSession,
      store,
      threadPublicId: "thr_immutable",
      username: "old-person",
    });

    expect(result).toEqual({
      status: "redirect",
      username: "person",
    });
  });

  it("returns 404 unavailable data for unknown thread public IDs", async () => {
    const result = await loadPublicThreadPage({
      session: anonymousSession,
      store: createThreadStore(),
      threadPublicId: "thr_missing",
      username: "person",
    });

    expect(result).toEqual({
      status: "page",
      responseStatus: 404,
      page: {
        status: "unavailable",
        username: "person",
        threadPublicId: "thr_missing",
      },
    });
  });

  it("returns published answers only in thread position order", async () => {
    const result = await loadAvailableThread({
      rows: [
        createItem({ publicId: "titem_3", position: 2 }),
        createItem({ publicId: "titem_draft", itemStatus: "draft", position: 1 }),
        createItem({ publicId: "titem_1", position: 0 }),
      ],
    });

    expect(getPage(result).items).toMatchObject([
      { type: "answer", publicId: "titem_1" },
      { type: "answer", publicId: "titem_3" },
    ]);
  });

  it("returns generic unavailable data for hidden thread and initial item states", async () => {
    for (const threadStatus of ["draft", "unpublished", "deleted"] as const) {
      const result = await loadAvailableThread({
        thread: createThread({ status: threadStatus }),
      });

      expect(result).toMatchObject({
        status: "page",
        responseStatus: 200,
        page: { status: "unavailable" },
      });
    }

    for (const itemStatus of ["draft", "unpublished", "deleted"] as const) {
      const result = await loadAvailableThread({
        rows: [createItem({ itemStatus })],
      });

      expect(result).toMatchObject({
        status: "page",
        responseStatus: 200,
        page: { status: "unavailable" },
      });
    }
  });

  it("returns generic unavailable data for inactive or deleted owners", async () => {
    await expect(
      loadAvailableThread({
        thread: createThread({ ownerIsActive: false }),
      }),
    ).resolves.toMatchObject({
      status: "page",
      responseStatus: 200,
      page: { status: "unavailable" },
    });

    await expect(
      loadAvailableThread({
        thread: createThread({ ownerUserDeletedAt: now }),
      }),
    ).resolves.toMatchObject({
      status: "page",
      responseStatus: 200,
      page: { status: "unavailable" },
    });
  });

  it("shows a removed marker for removed middle answers before later published answers", async () => {
    const result = await loadAvailableThread({
      rows: [
        createItem({ publicId: "titem_1", position: 0 }),
        createItem({
          answerText: "Removed private answer",
          itemStatus: "deleted",
          position: 1,
          publicId: "titem_removed",
          questionId: "question_2",
        }),
        createItem({
          answerText: "Later answer",
          position: 2,
          publicId: "titem_3",
          questionId: "question_3",
        }),
      ],
    });
    const serializedPage = JSON.stringify(getPage(result));

    expect(getPage(result).items).toMatchObject([
      { type: "answer", publicId: "titem_1" },
      { type: "removed" },
      { type: "answer", publicId: "titem_3", answerText: "Later answer" },
    ]);
    expect(serializedPage).not.toContain("Removed private answer");
  });

  it("omits hidden question text from serialized page data", async () => {
    const result = await loadAvailableThread({
      rows: [
        createItem({
          displayQuestionText: "Secret hidden question",
          questionTextMode: "hidden",
        }),
      ],
    });
    const page = getPage(result);
    const firstItem = page.items.at(0);

    expect(JSON.stringify(page)).not.toContain("Secret hidden question");
    if (firstItem === undefined) {
      throw new Error("expected first thread item");
    }
    expect("questionText" in firstItem).toBe(false);
  });

  it("sets owner controls for owner, anonymous, and non-owner sessions", async () => {
    await expect(
      loadAvailableThread({ session: ownerSession }),
    ).resolves.toMatchObject({
      status: "page",
      page: {
        status: "available",
        publishedAnswerControls: {
          canManage: true,
          disabled: false,
        },
      },
    });

    await expect(
      loadAvailableThread({ session: anonymousSession }),
    ).resolves.toMatchObject({
      status: "page",
      page: {
        status: "available",
        publishedAnswerControls: {
          canManage: false,
          disabled: false,
        },
      },
    });

    await expect(
      loadAvailableThread({ session: nonOwnerSession }),
    ).resolves.toMatchObject({
      status: "page",
      page: {
        status: "available",
        publishedAnswerControls: {
          canManage: false,
          disabled: false,
        },
      },
    });
  });

  it("sets follow and per-answer like state for non-owner viewers", async () => {
    await expect(
      loadAvailableThread({
        rows: [
          createItem({
            likeCount: 3,
            viewerLiked: true,
          }),
        ],
        session: nonOwnerSession,
        viewerFollowingProfileIds: ["profile_1"],
      }),
    ).resolves.toMatchObject({
      status: "page",
      page: {
        status: "available",
        follow: {
          visible: true,
          isFollowing: true,
          disabled: false,
        },
        items: [
          {
            type: "answer",
            like: {
              isLiked: true,
              count: 3,
              disabled: false,
            },
          },
        ],
      },
    });
  });
});

function loadAvailableThread({
  rows = [createItem()],
  session = anonymousSession,
  thread = createThread(),
  viewerFollowingProfileIds = [],
}: {
  rows?: PublicThreadItemRow[];
  session?: Parameters<typeof loadPublicThreadPage>[0]["session"];
  thread?: PublicThreadRecord;
  viewerFollowingProfileIds?: string[];
} = {}) {
  return loadPublicThreadPage({
    session,
    store: createThreadStore({
      rows,
      threads: [thread],
      viewerFollowingProfileIds,
    }),
    threadPublicId: thread.publicId,
    username: thread.ownerUsername,
  });
}

function getPage(result: Awaited<ReturnType<typeof loadAvailableThread>>) {
  if (result.status !== "page" || result.page.status !== "available") {
    throw new Error("expected available page");
  }

  return result.page;
}

function createThreadStore({
  rows = [createItem()],
  threads = [],
  viewerFollowingProfileIds = [],
}: {
  rows?: PublicThreadItemRow[];
  threads?: PublicThreadRecord[];
  viewerFollowingProfileIds?: string[];
} = {}): PublicThreadStore {
  return {
    findThreadByPublicId(threadPublicId) {
      return Promise.resolve(
        threads.find((thread) => thread.publicId === threadPublicId),
      );
    },
    findThreadItems({ threadId }) {
      const thread = threads.find((candidate) => candidate.id === threadId);

      return Promise.resolve(thread === undefined ? [] : rows);
    },
    isViewerFollowingProfile({ targetProfileId }) {
      return Promise.resolve(viewerFollowingProfileIds.includes(targetProfileId));
    },
  };
}

function createThread(
  overrides: Partial<PublicThreadRecord> = {},
): PublicThreadRecord {
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
    ownerShowLikeCounts: true,
    anonymousQuestionsEnabled: true,
    followUpPermissionDefault: "anyone",
    followUpPermissionOverride: null,
    followUpsEnabled: true,
    initialQuestionId: "question_1",
    initialQuestionAskerUserId: null,
    publishedAt: now,
    ...overrides,
  };
}

function createItem(
  overrides: Partial<PublicThreadItemRow> = {},
): PublicThreadItemRow {
  return {
    publicId: "titem_1",
    questionId: "question_1",
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

const anonymousSession = {
  status: "anonymous",
} satisfies Parameters<typeof loadPublicThreadPage>[0]["session"];

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
} satisfies CompletedProfileSessionSummary;

const nonOwnerSession = {
  ...ownerSession,
  user: {
    ...ownerSession.user,
    id: "user_2",
    email: "other@example.com",
  },
  profile: {
    ...ownerSession.profile,
    id: "profile_2",
    username: "other",
  },
} satisfies CompletedProfileSessionSummary;
