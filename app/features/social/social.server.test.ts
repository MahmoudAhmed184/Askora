import { describe, expect, it } from "vitest";

import type { CompletedProfileSessionSummary } from "~/features/auth/auth.server";
import {
  handleFollowAction,
  type FollowActionStore,
  type FollowMutationParams,
  type FollowTargetProfile,
} from "~/features/social/follow.action.server";
import {
  loadSocialFeed,
  type SocialFeedRow,
  type SocialFeedStore,
} from "~/features/social/feed.loader.server";
import {
  handleLikeAction,
  type LikeActionStore,
  type LikeMutationParams,
  type LikeableAnswer,
} from "~/features/social/like.action.server";
import { decodeFeedCursor, type FeedCursor } from "~/features/social/social.schema";

const now = new Date("2026-05-31T12:00:00.000Z");

describe("like actions", () => {
  it("likes and unlikes idempotently with one durable first-like notification", async () => {
    const likes = createLikeStore();

    await expect(submitLike({ store: likes.store })).resolves.toMatchObject({
      status: "liked",
      notificationCreated: true,
    });
    await expect(submitLike({ store: likes.store })).resolves.toMatchObject({
      status: "liked",
      notificationCreated: false,
    });
    await expect(
      submitLike({ intent: "unlike", store: likes.store }),
    ).resolves.toMatchObject({ status: "unliked" });
    await expect(
      submitLike({ intent: "unlike", store: likes.store }),
    ).resolves.toMatchObject({ status: "unliked" });
    await expect(submitLike({ store: likes.store })).resolves.toMatchObject({
      status: "liked",
      notificationCreated: false,
    });

    expect(likes.likeKeys()).toEqual(["profile_actor:item_1"]);
    expect(likes.notifications).toEqual([
      {
        actorUserId: "user_actor",
        ownerUserId: "user_owner",
        threadItemId: "item_1",
      },
    ]);
  });

  it("denies own, suspended, blocked, and unavailable answer likes", async () => {
    const own = createLikeStore({
      answers: [
        createLikeableAnswer({
          ownerProfileId: "profile_actor",
          ownerUserId: "user_actor",
        }),
      ],
    });
    await expect(submitLike({ store: own.store })).resolves.toMatchObject({
      status: "denied",
      reason: "own_answer",
    });

    const suspended = createLikeStore();
    await expect(
      submitLike({
        session: { ...completedSession, suspensionStatus: "active" },
        store: suspended.store,
      }),
    ).resolves.toMatchObject({ status: "denied", reason: "suspended" });

    const blocked = createLikeStore({ blockedOwnerProfileIds: ["profile_owner"] });
    await expect(submitLike({ store: blocked.store })).resolves.toMatchObject({
      status: "denied",
      reason: "blocked",
    });

    for (const answer of [
      createLikeableAnswer({ itemStatus: "unpublished" }),
      createLikeableAnswer({ itemDeletedAt: now }),
      createLikeableAnswer({ threadStatus: "deleted" }),
      createLikeableAnswer({ ownerIsActive: false }),
      createLikeableAnswer({ ownerUserDeletedAt: now }),
    ]) {
      const unavailable = createLikeStore({ answers: [answer] });

      await expect(
        submitLike({ store: unavailable.store }),
      ).resolves.toMatchObject({ status: "denied", reason: "not_found" });
    }
  });
});

describe("follow actions", () => {
  it("follows and unfollows idempotently", async () => {
    const follows = createFollowStore();

    await expect(submitFollow({ store: follows.store })).resolves.toMatchObject({
      status: "followed",
    });
    await expect(submitFollow({ store: follows.store })).resolves.toMatchObject({
      status: "followed",
    });
    expect(follows.followKeys()).toEqual(["profile_actor:profile_target"]);

    await expect(
      submitFollow({ intent: "unfollow", store: follows.store }),
    ).resolves.toMatchObject({ status: "unfollowed" });
    await expect(
      submitFollow({ intent: "unfollow", store: follows.store }),
    ).resolves.toMatchObject({ status: "unfollowed" });
    expect(follows.followKeys()).toEqual([]);
  });

  it("denies self, suspended, blocked, inactive, and deleted targets", async () => {
    const self = createFollowStore({
      profiles: [
        createFollowTarget({
          id: "profile_actor",
          userId: "user_actor",
          username: "actor",
        }),
      ],
    });
    await expect(
      submitFollow({ store: self.store, username: "actor" }),
    ).resolves.toMatchObject({ status: "denied", reason: "self_follow" });

    const suspended = createFollowStore();
    await expect(
      submitFollow({
        session: { ...completedSession, suspensionStatus: "active" },
        store: suspended.store,
      }),
    ).resolves.toMatchObject({ status: "denied", reason: "suspended" });

    const blocked = createFollowStore({ blockedTargetProfileIds: ["profile_target"] });
    await expect(submitFollow({ store: blocked.store })).resolves.toMatchObject({
      status: "denied",
      reason: "blocked",
    });

    for (const profile of [
      createFollowTarget({ isActive: false }),
      createFollowTarget({ userDeletedAt: now }),
    ]) {
      const unavailable = createFollowStore({ profiles: [profile] });

      await expect(
        submitFollow({ store: unavailable.store }),
      ).resolves.toMatchObject({ status: "denied", reason: "not_found" });
    }
  });
});

describe("social feed", () => {
  it("includes followed published answers only and preserves public visibility", async () => {
    const store = createFeedStore({
      followedProfileIds: ["profile_owner"],
      rows: [
        createFeedRow({ threadItemPublicId: "visible" }),
        createFeedRow({
          ownerProfileId: "profile_unfollowed",
          threadItemPublicId: "unfollowed",
        }),
        createFeedRow({ blockedByOwner: true, threadItemPublicId: "blocked" }),
        createFeedRow({ itemStatus: "unpublished", threadItemPublicId: "draft" }),
        createFeedRow({ ownerIsActive: false, threadItemPublicId: "inactive" }),
        createFeedRow({
          displayQuestionText: "Secret prompt",
          questionTextMode: "hidden",
          threadItemPublicId: "hidden_question",
        }),
      ],
    });

    const feed = await loadSocialFeed({ session: completedSession, store });

    expect(feed.items.map((item) => item.threadItemPublicId)).toEqual([
      "visible",
      "hidden_question",
    ]);
    expect(feed.items[1]?.questionText).toBeNull();
    expect(JSON.stringify(feed.items)).not.toContain("Secret prompt");
  });

  it("paginates with a stable newest-first cursor", async () => {
    const rows = Array.from({ length: 25 }, (_, index) =>
      createFeedRow({
        createdAt: new Date(`2026-05-31T10:${String(index).padStart(2, "0")}:00.000Z`),
        publishedAt: new Date(`2026-05-31T11:${String(index).padStart(2, "0")}:00.000Z`),
        threadItemPublicId: `titem_${String(index).padStart(2, "0")}`,
      }),
    );
    const store = createFeedStore({
      followedProfileIds: ["profile_owner"],
      rows,
    });
    const firstPage = await loadSocialFeed({ session: completedSession, store });
    const secondPage = await loadSocialFeed({
      cursor: decodeRequiredCursor(firstPage.nextCursor),
      session: completedSession,
      store,
    });

    expect(firstPage.items).toHaveLength(20);
    expect(firstPage.items[0]?.threadItemPublicId).toBe("titem_24");
    expect(firstPage.items.at(-1)?.threadItemPublicId).toBe("titem_05");
    expect(secondPage.items.map((item) => item.threadItemPublicId)).toEqual([
      "titem_04",
      "titem_03",
      "titem_02",
      "titem_01",
      "titem_00",
    ]);
    expect(secondPage.nextCursor).toBeUndefined();
  });
});

async function submitLike({
  intent = "like",
  session = completedSession,
  store,
}: {
  intent?: "like" | "unlike";
  session?: CompletedProfileSessionSummary;
  store: LikeActionStore;
}) {
  const formData = new FormData();

  formData.set("intent", intent);
  formData.set("threadItemPublicId", "titem_1");
  formData.set("returnTo", "/person#published-answers");

  return handleLikeAction({
    createId: () => "notification_1",
    formData,
    now,
    session,
    store,
  });
}

function createLikeStore({
  answers = [createLikeableAnswer()],
  blockedOwnerProfileIds = [],
}: {
  answers?: LikeableAnswer[];
  blockedOwnerProfileIds?: string[];
} = {}) {
  const likeKeys = new Set<string>();
  const notificationDedupeKeys = new Set<string>();
  const notifications: {
    actorUserId: string;
    ownerUserId: string;
    threadItemId: string;
  }[] = [];
  const store: LikeActionStore = {
    findAnswerForLike(publicId) {
      return Promise.resolve(
        answers.find((answer) => answer.publicId === publicId),
      );
    },
    isActorBlockedByOwner({ ownerProfileId }) {
      return Promise.resolve(blockedOwnerProfileIds.includes(ownerProfileId));
    },
    likeAnswer(params) {
      const likeKey = createLikeKey(params);

      if (likeKeys.has(likeKey)) {
        return Promise.resolve({ notificationCreated: false });
      }

      likeKeys.add(likeKey);

      const dedupeKey = createNotificationDedupeKey(params);

      if (notificationDedupeKeys.has(dedupeKey)) {
        return Promise.resolve({ notificationCreated: false });
      }

      notificationDedupeKeys.add(dedupeKey);
      notifications.push({
        actorUserId: params.session.user.id,
        ownerUserId: params.answer.ownerUserId,
        threadItemId: params.answer.id,
      });

      return Promise.resolve({ notificationCreated: true });
    },
    unlikeAnswer(params) {
      likeKeys.delete(createLikeKey(params));

      return Promise.resolve();
    },
  };

  return {
    notifications,
    store,
    likeKeys: () => [...likeKeys].sort(),
  };
}

function createLikeKey(params: LikeMutationParams) {
  return `${params.session.profile.id}:${params.answer.id}`;
}

function createNotificationDedupeKey(params: LikeMutationParams) {
  return `${params.session.user.id}:${params.answer.id}:${params.answer.ownerUserId}`;
}

function createLikeableAnswer(
  overrides: Partial<LikeableAnswer> = {},
): LikeableAnswer {
  return {
    id: "item_1",
    publicId: "titem_1",
    threadId: "thread_1",
    ownerProfileId: "profile_owner",
    ownerUserId: "user_owner",
    ownerIsActive: true,
    ownerUserDeletedAt: null,
    itemStatus: "published",
    itemDeletedAt: null,
    threadStatus: "published",
    ...overrides,
  };
}

async function submitFollow({
  intent = "follow",
  session = completedSession,
  store,
  username = "target",
}: {
  intent?: "follow" | "unfollow";
  session?: CompletedProfileSessionSummary;
  store: FollowActionStore;
  username?: string;
}) {
  const formData = new FormData();

  formData.set("intent", intent);
  formData.set("username", username);
  formData.set("returnTo", "/target");

  return handleFollowAction({
    formData,
    now,
    session,
    store,
  });
}

function createFollowStore({
  blockedTargetProfileIds = [],
  profiles = [createFollowTarget()],
}: {
  blockedTargetProfileIds?: string[];
  profiles?: FollowTargetProfile[];
} = {}) {
  const followKeys = new Set<string>();
  const store: FollowActionStore = {
    findTargetProfileByUsername(username) {
      return Promise.resolve(
        profiles.find((profile) => profile.username === username),
      );
    },
    isActorBlockedByTarget({ targetProfileId }) {
      return Promise.resolve(blockedTargetProfileIds.includes(targetProfileId));
    },
    followProfile(params) {
      followKeys.add(createFollowKey(params));

      return Promise.resolve();
    },
    unfollowProfile(params) {
      followKeys.delete(createFollowKey(params));

      return Promise.resolve();
    },
  };

  return {
    store,
    followKeys: () => [...followKeys].sort(),
  };
}

function createFollowKey(params: FollowMutationParams) {
  return `${params.session.profile.id}:${params.target.id}`;
}

function createFollowTarget(
  overrides: Partial<FollowTargetProfile> = {},
): FollowTargetProfile {
  return {
    id: "profile_target",
    userId: "user_target",
    username: "target",
    isActive: true,
    userDeletedAt: null,
    ...overrides,
  };
}

function createFeedStore({
  followedProfileIds,
  rows,
}: {
  followedProfileIds: string[];
  rows: SocialFeedRow[];
}): SocialFeedStore {
  return {
    findFeedRows({ cursor, limit }) {
      return Promise.resolve(
        rows
          .filter((row) => followedProfileIds.includes(row.ownerProfileId))
          .filter((row) => isAfterCursor(row, cursor))
          .sort(compareFeedRowsForTest)
          .slice(0, limit),
      );
    },
  };
}

function createFeedRow(overrides: Partial<SocialFeedRow> = {}): SocialFeedRow {
  return {
    threadItemId: "item_1",
    threadItemPublicId: "titem_1",
    threadPublicId: "thr_1",
    answerText: "Published answer",
    itemStatus: "published",
    itemDeletedAt: null,
    publishedAt: new Date("2026-05-31T11:00:00.000Z"),
    createdAt: new Date("2026-05-31T10:00:00.000Z"),
    threadStatus: "published",
    ownerProfileId: "profile_owner",
    ownerUserId: "user_owner",
    ownerUsername: "owner",
    ownerDisplayName: "Owner",
    ownerAvatarUrl: null,
    ownerIsActive: true,
    ownerUserDeletedAt: null,
    ownerShowLikeCounts: true,
    blockedByOwner: false,
    questionStatus: "answered",
    questionDeletedAt: null,
    questionTextMode: "original",
    displayQuestionText: "What should I read next?",
    identityMode: "guest_anonymous",
    askerDisplayName: null,
    askerUsername: null,
    likeCount: 2,
    viewerLiked: false,
    ...overrides,
  };
}

function isAfterCursor(row: SocialFeedRow, cursor: FeedCursor | undefined) {
  if (cursor === undefined) {
    return true;
  }

  const sortTime = getFeedSortTime(row).getTime();
  const cursorSortTime = new Date(cursor.publishedAt).getTime();

  if (sortTime !== cursorSortTime) {
    return sortTime < cursorSortTime;
  }

  const createdTime = row.createdAt.getTime();
  const cursorCreatedTime = new Date(cursor.createdAt).getTime();

  if (createdTime !== cursorCreatedTime) {
    return createdTime < cursorCreatedTime;
  }

  return row.threadItemPublicId < cursor.publicId;
}

function compareFeedRowsForTest(left: SocialFeedRow, right: SocialFeedRow) {
  const sortOrder =
    getFeedSortTime(right).getTime() - getFeedSortTime(left).getTime();

  if (sortOrder !== 0) {
    return sortOrder;
  }

  const createdOrder = right.createdAt.getTime() - left.createdAt.getTime();

  if (createdOrder !== 0) {
    return createdOrder;
  }

  return right.threadItemPublicId.localeCompare(left.threadItemPublicId);
}

function getFeedSortTime(row: SocialFeedRow) {
  return row.publishedAt ?? row.createdAt;
}

function decodeRequiredCursor(cursor: string | undefined) {
  const decoded = decodeFeedCursor(cursor);

  if (decoded === undefined) {
    throw new Error("expected next cursor");
  }

  return decoded;
}

const completedSession = {
  status: "authenticated",
  profileStatus: "complete",
  suspensionStatus: "none",
  user: {
    id: "user_actor",
    email: "actor@example.com",
    name: "Actor",
    image: undefined,
  },
  profile: {
    id: "profile_actor",
    username: "actor",
    displayName: "Actor",
    avatarUrl: null,
  },
} satisfies CompletedProfileSessionSummary;
