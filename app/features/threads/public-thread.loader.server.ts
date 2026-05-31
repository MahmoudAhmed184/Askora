import { and, asc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { getRuntimeDatabase, type RuntimeDatabase } from "~/db/client.server";
import {
  authUsers,
  follows,
  pinnedAnswers,
  profiles,
  questions,
  threadItems,
  threads,
} from "~/db/schema";
import type { AnswerQuestionIdentity } from "~/features/answers/answer.server";
import {
  getPublishedAnswerControlState,
  type PublishedAnswerControlState,
} from "~/features/answers/published-answer-controls.server";
import type { QuestionTextMode } from "~/features/answers/answer.schema";
import type { CurrentSessionSummary } from "~/features/auth/auth.server";
import { findThreadItemLikeSummaries } from "~/features/social/social-data.server";
import {
  getFollowControlState,
  getLikeControlState,
  type FollowControlState,
  type LikeControlState,
} from "~/features/social/social-controls";
import {
  getPublicThreadFollowUpState,
  type PublicThreadFollowUpState,
} from "~/features/threads/thread-permissions.server";
import type { FollowUpPermission } from "~/features/settings/settings.schema";

type ThreadStatus = "draft" | "published" | "unpublished" | "deleted";
type ThreadItemStatus = "draft" | "published" | "unpublished" | "deleted";
type QuestionStatus = "inbox" | "filtered" | "draft" | "answered";

export interface PublicThreadRecord {
  id: string;
  publicId: string;
  status: ThreadStatus;
  ownerProfileId: string;
  ownerUserId: string;
  ownerUsername: string;
  ownerDisplayName: string;
  ownerAvatarUrl: string | null;
  ownerIsActive: boolean;
  ownerUserDeletedAt: Date | null;
  ownerShowLikeCounts: boolean;
  anonymousQuestionsEnabled: boolean;
  followUpPermissionDefault: FollowUpPermission;
  followUpPermissionOverride: FollowUpPermission | null;
  followUpsEnabled: boolean;
  initialQuestionId: string;
  initialQuestionAskerUserId: string | null;
  publishedAt: Date | null;
}

export interface PublicThreadItemRow {
  threadItemId?: string | undefined;
  publicId: string;
  questionId: string;
  answerText: string;
  itemStatus: ThreadItemStatus;
  itemDeletedAt: Date | null;
  publishedAt: Date | null;
  createdAt: Date;
  position: number;
  pinPosition: number | null;
  questionStatus: QuestionStatus;
  questionDeletedAt: Date | null;
  questionTextMode: QuestionTextMode;
  displayQuestionText: string | null;
  identityMode: AnswerQuestionIdentity;
  askerDisplayName: string | null;
  askerUsername: string | null;
  likeCount?: number | undefined;
  viewerLiked?: boolean | undefined;
}

export interface PublicThreadStore {
  findThreadByPublicId(
    threadPublicId: string,
  ): Promise<PublicThreadRecord | undefined>;
  findThreadItems(params: {
    threadId: string;
    viewerProfileId: string | undefined;
  }): Promise<PublicThreadItemRow[]>;
  isViewerFollowingProfile(params: {
    targetProfileId: string;
    viewerProfileId: string;
  }): Promise<boolean>;
}

export type PublicThreadLoadResult =
  | {
      status: "redirect";
      username: string;
    }
  | {
      status: "page";
      page: PublicThreadPageData;
      responseStatus: 200 | 404;
    };

export type PublicThreadPageData =
  | {
      status: "available";
      profile: PublicThreadProfileView;
      thread: PublicThreadView;
      items: PublicThreadItem[];
      followUp: PublicThreadFollowUpState;
      publishedAnswerControls: PublishedAnswerControlState;
      follow: FollowControlState;
    }
  | {
      status: "unavailable";
      username: string;
      threadPublicId: string;
    };

export interface PublicThreadProfileView {
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface PublicThreadView {
  publicId: string;
  publishedAt: string;
}

export type PublicThreadItem = PublicThreadAnswerItem | PublicThreadRemovedItem;

export interface PublicThreadAnswerItem {
  type: "answer";
  publicId: string;
  answerText: string;
  publishedAt: string;
  pinPosition: number | null;
  like: LikeControlState;
  questionText?: string;
  asker?: {
    displayName: string;
    username: string;
  };
}

export interface PublicThreadRemovedItem {
  type: "removed";
  position: number;
}

export async function loadPublicThreadPage({
  session,
  store = createDrizzlePublicThreadStore(),
  threadPublicId,
  username,
}: {
  username: string;
  threadPublicId: string;
  session: CurrentSessionSummary;
  store?: PublicThreadStore;
}): Promise<PublicThreadLoadResult> {
  const thread = await store.findThreadByPublicId(threadPublicId);

  if (thread === undefined) {
    return unavailableThreadResult({ threadPublicId, username }, 404);
  }

  if (thread.ownerUsername !== username) {
    return {
      status: "redirect",
      username: thread.ownerUsername,
    };
  }

  if (!isPublishedThreadAvailable(thread)) {
    return unavailableThreadResult(
      { threadPublicId: thread.publicId, username: thread.ownerUsername },
      200,
    );
  }

  const [rows, isViewerFollowing] = await Promise.all([
    store.findThreadItems({
      threadId: thread.id,
      viewerProfileId: getViewerProfileId(session),
    }),
    findViewerFollowState({
      session,
      store,
      targetProfileId: thread.ownerProfileId,
    }),
  ]);
  const initialItem = rows.find(
    (row) => row.questionId === thread.initialQuestionId,
  );

  if (initialItem === undefined || !isVisiblePublishedThreadItem(initialItem)) {
    return unavailableThreadResult(
      { threadPublicId: thread.publicId, username: thread.ownerUsername },
      200,
    );
  }

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
        publishedAt: (thread.publishedAt ?? initialItem.publishedAt ?? new Date(0)).toISOString(),
      },
      items: createPublicThreadItems({
        initialQuestionId: thread.initialQuestionId,
        owner: {
          profileId: thread.ownerProfileId,
          showLikeCounts: thread.ownerShowLikeCounts,
          userId: thread.ownerUserId,
        },
        rows,
        session,
      }),
      followUp: getPublicThreadFollowUpState({
        actor: session,
        target: {
          status: thread.status,
          ownerIsActive: thread.ownerIsActive,
          ownerUserDeletedAt: thread.ownerUserDeletedAt,
          anonymousQuestionsEnabled: thread.anonymousQuestionsEnabled,
          followUpsEnabled: thread.followUpsEnabled,
          followUpPermissionDefault: thread.followUpPermissionDefault,
          followUpPermissionOverride: thread.followUpPermissionOverride,
          initialQuestionAskerUserId: thread.initialQuestionAskerUserId,
          publishedItemCount: rows.filter(isVisiblePublishedThreadItem).length,
        },
      }),
      publishedAnswerControls: getPublishedAnswerControlState({
        owner: {
          id: thread.ownerProfileId,
          userId: thread.ownerUserId,
        },
        session,
      }),
      follow: getFollowControlState({
        isFollowing: isViewerFollowing,
        session,
        target: {
          id: thread.ownerProfileId,
          isActive: thread.ownerIsActive,
          userId: thread.ownerUserId,
          username: thread.ownerUsername,
        },
      }),
    },
    responseStatus: 200,
  };
}

export function createDrizzlePublicThreadStore(
  database: RuntimeDatabase = getRuntimeDatabase(),
): PublicThreadStore {
  return {
    async findThreadByPublicId(threadPublicId) {
      const initialQuestions = alias(questions, "public_thread_initial_questions");
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
          ownerShowLikeCounts: profiles.showLikeCounts,
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
    async findThreadItems({ threadId, viewerProfileId }) {
      const askerProfiles = alias(profiles, "thread_asker_profiles");

      const rows = await database
        .select({
          threadItemId: threadItems.id,
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
      const summaries = await findThreadItemLikeSummaries({
        database,
        threadItemIds: rows.map((row) => row.threadItemId),
        viewerProfileId,
      });

      return rows.map((row) => {
        const summary = summaries.get(row.threadItemId);

        return {
          ...row,
          likeCount: summary?.count ?? 0,
          viewerLiked: summary?.isLikedByViewer ?? false,
        };
      });
    },
    async isViewerFollowingProfile({ targetProfileId, viewerProfileId }) {
      const [follow] = await database
        .select({ followedProfileId: follows.followedProfileId })
        .from(follows)
        .where(
          and(
            eq(follows.followerProfileId, viewerProfileId),
            eq(follows.followedProfileId, targetProfileId),
          ),
        )
        .limit(1);

      return follow !== undefined;
    },
  };
}

export function createPublicThreadItems({
  owner = anonymousThreadOwner,
  initialQuestionId,
  rows,
  session = anonymousSession,
}: {
  initialQuestionId: string;
  rows: PublicThreadItemRow[];
  owner?: PublicThreadItemOwner | undefined;
  session?: CurrentSessionSummary | undefined;
}): PublicThreadItem[] {
  const sortedRows = [...rows].sort(compareThreadItemRows);

  return sortedRows.flatMap((row, index): PublicThreadItem[] => {
    if (isVisiblePublishedThreadItem(row)) {
      return [toPublicThreadAnswerItem({ owner, row, session })];
    }

    if (shouldShowRemovedMarker({ index, initialQuestionId, rows: sortedRows })) {
      return [
        {
          type: "removed" as const,
          position: row.position,
        },
      ];
    }

    return [];
  });
}

function unavailableThreadResult(
  page: {
    username: string;
    threadPublicId: string;
  },
  responseStatus: 200 | 404,
): PublicThreadLoadResult {
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

function isPublishedThreadAvailable(thread: PublicThreadRecord) {
  return (
    thread.status === "published" &&
    thread.ownerIsActive &&
    thread.ownerUserDeletedAt === null
  );
}

interface PublicThreadItemOwner {
  profileId: string;
  userId: string;
  showLikeCounts: boolean;
}

function toPublicThreadAnswerItem({
  owner,
  row,
  session,
}: {
  owner: PublicThreadItemOwner;
  row: PublicThreadItemRow;
  session: CurrentSessionSummary;
}): PublicThreadAnswerItem {
  const questionText = getPublicQuestionText(row);

  return {
    type: "answer",
    publicId: row.publicId,
    answerText: row.answerText,
    publishedAt: (row.publishedAt ?? new Date(0)).toISOString(),
    pinPosition: row.pinPosition,
    like: getLikeControlState({
      count: owner.showLikeCounts ? (row.likeCount ?? 0) : undefined,
      isLiked: row.viewerLiked ?? false,
      session,
      target: {
        ownerProfileId: owner.profileId,
        ownerUserId: owner.userId,
        threadItemPublicId: row.publicId,
      },
    }),
    ...(questionText === undefined ? {} : { questionText }),
    ...getPublicAsker(row, questionText),
  };
}

function getPublicAsker(
  row: PublicThreadItemRow,
  questionText: string | undefined,
) {
  if (
    questionText === undefined ||
    row.identityMode !== "account_attributed" ||
    row.askerDisplayName === null ||
    row.askerUsername === null
  ) {
    return {};
  }

  return {
    asker: {
      displayName: row.askerDisplayName,
      username: row.askerUsername,
    },
  };
}

async function findViewerFollowState({
  session,
  store,
  targetProfileId,
}: {
  session: CurrentSessionSummary;
  store: PublicThreadStore;
  targetProfileId: string;
}) {
  const viewerProfileId = getViewerProfileId(session);

  if (viewerProfileId === undefined) {
    return false;
  }

  return store.isViewerFollowingProfile({
    targetProfileId,
    viewerProfileId,
  });
}

function getViewerProfileId(session: CurrentSessionSummary) {
  return session.status === "authenticated" && session.profileStatus === "complete"
    ? session.profile.id
    : undefined;
}

function getPublicQuestionText(row: PublicThreadItemRow) {
  if (
    row.questionTextMode === "hidden" ||
    row.questionDeletedAt !== null ||
    row.questionStatus !== "answered"
  ) {
    return undefined;
  }

  return row.displayQuestionText ?? undefined;
}

function shouldShowRemovedMarker({
  index,
  initialQuestionId,
  rows,
}: {
  index: number;
  initialQuestionId: string;
  rows: PublicThreadItemRow[];
}) {
  const row = rows[index];

  return (
    row !== undefined &&
    row.questionId !== initialQuestionId &&
    isRemovedPublishedThreadItem(row) &&
    rows.slice(index + 1).some(isVisiblePublishedThreadItem)
  );
}

function isVisiblePublishedThreadItem(row: PublicThreadItemRow) {
  return (
    row.itemStatus === "published" &&
    row.itemDeletedAt === null
  );
}

function isRemovedPublishedThreadItem(row: PublicThreadItemRow) {
  return (
    row.itemStatus === "unpublished" ||
    row.itemStatus === "deleted" ||
    (row.itemStatus === "published" && row.itemDeletedAt !== null)
  );
}

function compareThreadItemRows(
  left: PublicThreadItemRow,
  right: PublicThreadItemRow,
) {
  const positionOrder = left.position - right.position;

  if (positionOrder !== 0) {
    return positionOrder;
  }

  return left.createdAt.getTime() - right.createdAt.getTime();
}

const anonymousSession = {
  status: "anonymous",
} satisfies CurrentSessionSummary;

const anonymousThreadOwner = {
  profileId: "",
  userId: "",
  showLikeCounts: false,
} satisfies PublicThreadItemOwner;
