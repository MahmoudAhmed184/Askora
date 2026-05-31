import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { getRuntimeDatabase, type RuntimeDatabase } from "~/db/client.server";
import {
  authUsers,
  blocks,
  follows,
  profiles,
  questions,
  threadItems,
  threads,
} from "~/db/schema";
import type { AnswerQuestionIdentity } from "~/features/answers/answer.server";
import type { QuestionTextMode } from "~/features/answers/answer.schema";
import type { CompletedProfileSessionSummary } from "~/features/auth/auth.server";
import { findThreadItemLikeSummaries } from "~/features/social/social-data.server";
import { getLikeControlState, type LikeControlState } from "~/features/social/social-controls";
import {
  encodeFeedCursor,
  type FeedCursor,
} from "~/features/social/social.schema";

export const SOCIAL_FEED_PAGE_SIZE = 20;

type ThreadStatus = "draft" | "published" | "unpublished" | "deleted";
type ThreadItemStatus = "draft" | "published" | "unpublished" | "deleted";
type QuestionStatus = "inbox" | "filtered" | "draft" | "answered";

export interface SocialFeedRow {
  threadItemId: string;
  threadItemPublicId: string;
  threadPublicId: string;
  answerText: string;
  itemStatus: ThreadItemStatus;
  itemDeletedAt: Date | null;
  publishedAt: Date | null;
  createdAt: Date;
  threadStatus: ThreadStatus;
  ownerProfileId: string;
  ownerUserId: string;
  ownerUsername: string;
  ownerDisplayName: string;
  ownerAvatarUrl: string | null;
  ownerIsActive: boolean;
  ownerUserDeletedAt: Date | null;
  ownerShowLikeCounts: boolean;
  blockedByOwner: boolean;
  questionStatus: QuestionStatus;
  questionDeletedAt: Date | null;
  questionTextMode: QuestionTextMode;
  displayQuestionText: string | null;
  identityMode: AnswerQuestionIdentity;
  askerDisplayName: string | null;
  askerUsername: string | null;
  likeCount: number;
  viewerLiked: boolean;
}

export interface SocialFeedItem {
  owner: {
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  threadPublicId: string;
  threadItemPublicId: string;
  answerText: string;
  publishedAt: string;
  questionText: string | null;
  asker:
    | {
        displayName: string;
        username: string;
      }
    | undefined;
  like: LikeControlState;
}

export interface SocialFeedPageData {
  profile: {
    username: string;
    displayName: string;
  };
  items: SocialFeedItem[];
  nextCursor: string | undefined;
}

export interface SocialFeedStore {
  findFeedRows(params: {
    cursor: FeedCursor | undefined;
    limit: number;
    viewerProfileId: string;
    viewerUserId: string;
  }): Promise<SocialFeedRow[]>;
}

export async function loadSocialFeed({
  cursor,
  session,
  store = createDrizzleSocialFeedStore(),
}: {
  session: CompletedProfileSessionSummary;
  cursor?: FeedCursor | undefined;
  store?: SocialFeedStore;
}): Promise<SocialFeedPageData> {
  const rows = await store.findFeedRows({
    cursor,
    limit: SOCIAL_FEED_PAGE_SIZE + 1,
    viewerProfileId: session.profile.id,
    viewerUserId: session.user.id,
  });
  const visibleRows = rows
    .filter(isVisibleFeedRow)
    .sort(compareFeedRows)
    .slice(0, SOCIAL_FEED_PAGE_SIZE + 1);
  const pageRows = visibleRows.slice(0, SOCIAL_FEED_PAGE_SIZE);

  return {
    profile: {
      username: session.profile.username,
      displayName: session.profile.displayName,
    },
    items: pageRows.map((row) => toSocialFeedItem(row, session)),
    nextCursor:
      visibleRows.length > SOCIAL_FEED_PAGE_SIZE
        ? encodeFeedCursor(createCursorFromRow(pageRows.at(-1)))
        : undefined,
  };
}

export function createDrizzleSocialFeedStore(
  database: RuntimeDatabase = getRuntimeDatabase(),
): SocialFeedStore {
  return {
    async findFeedRows({ cursor, limit, viewerProfileId, viewerUserId }) {
      const askerProfiles = alias(profiles, "feed_asker_profiles");
      const ownerBlocks = alias(blocks, "feed_owner_blocks");
      const sortExpression = sql<Date>`coalesce(${threadItems.publishedAt}, ${threadItems.createdAt})`;
      const cursorWhere = createCursorWhere(cursor, sortExpression);
      const baseWhere = and(
        eq(follows.followerProfileId, viewerProfileId),
        eq(threads.status, "published"),
        eq(threadItems.status, "published"),
        isNull(threadItems.deletedAt),
        eq(profiles.isActive, true),
        isNull(authUsers.deletedAt),
        isNull(ownerBlocks.id),
      );
      const rows = await database
        .select({
          threadItemId: threadItems.id,
          threadItemPublicId: threadItems.publicId,
          threadPublicId: threads.publicId,
          answerText: threadItems.answerText,
          itemStatus: threadItems.status,
          itemDeletedAt: threadItems.deletedAt,
          publishedAt: threadItems.publishedAt,
          createdAt: threadItems.createdAt,
          threadStatus: threads.status,
          ownerProfileId: profiles.id,
          ownerUserId: profiles.userId,
          ownerUsername: profiles.username,
          ownerDisplayName: profiles.displayName,
          ownerAvatarUrl: profiles.avatarUrl,
          ownerIsActive: profiles.isActive,
          ownerUserDeletedAt: authUsers.deletedAt,
          ownerShowLikeCounts: profiles.showLikeCounts,
          questionStatus: questions.status,
          questionDeletedAt: questions.deletedAt,
          questionTextMode: threadItems.questionTextMode,
          displayQuestionText: threadItems.displayQuestionText,
          identityMode: questions.identityMode,
          askerDisplayName: askerProfiles.displayName,
          askerUsername: askerProfiles.username,
        })
        .from(follows)
        .innerJoin(profiles, eq(profiles.id, follows.followedProfileId))
        .innerJoin(authUsers, eq(authUsers.id, profiles.userId))
        .innerJoin(threads, eq(threads.ownerProfileId, profiles.id))
        .innerJoin(threadItems, eq(threadItems.threadId, threads.id))
        .innerJoin(questions, eq(questions.id, threadItems.questionId))
        .leftJoin(askerProfiles, eq(askerProfiles.id, questions.askerProfileId))
        .leftJoin(
          ownerBlocks,
          and(
            eq(ownerBlocks.ownerProfileId, profiles.id),
            or(
              eq(ownerBlocks.blockedUserId, viewerUserId),
              eq(ownerBlocks.blockedProfileId, viewerProfileId),
            ),
          ),
        )
        .where(cursorWhere === undefined ? baseWhere : and(baseWhere, cursorWhere))
        .orderBy(
          desc(sortExpression),
          desc(threadItems.createdAt),
          desc(threadItems.publicId),
        )
        .limit(limit);
      const summaries = await findThreadItemLikeSummaries({
        database,
        threadItemIds: rows.map((row) => row.threadItemId),
        viewerProfileId,
      });

      return rows.map((row) => {
        const summary = summaries.get(row.threadItemId);

        return {
          ...row,
          blockedByOwner: false,
          likeCount: summary?.count ?? 0,
          viewerLiked: summary?.isLikedByViewer ?? false,
        };
      });
    },
  };
}

function createCursorWhere(
  cursor: FeedCursor | undefined,
  sortExpression: ReturnType<typeof sql<Date>>,
) {
  if (cursor === undefined) {
    return undefined;
  }

  return sql`(${sortExpression}, ${threadItems.createdAt}, ${threadItems.publicId}) < (${new Date(
    cursor.publishedAt,
  )}, ${new Date(cursor.createdAt)}, ${cursor.publicId})`;
}

function toSocialFeedItem(
  row: SocialFeedRow,
  session: CompletedProfileSessionSummary,
): SocialFeedItem {
  const questionText = getPublicQuestionText(row);

  return {
    owner: {
      username: row.ownerUsername,
      displayName: row.ownerDisplayName,
      avatarUrl: row.ownerAvatarUrl,
    },
    threadPublicId: row.threadPublicId,
    threadItemPublicId: row.threadItemPublicId,
    answerText: row.answerText,
    publishedAt: getFeedSortDate(row).toISOString(),
    questionText,
    asker: getPublicAsker(row, questionText),
    like: getLikeControlState({
      count: row.ownerShowLikeCounts ? row.likeCount : undefined,
      isLiked: row.viewerLiked,
      session,
      target: {
        ownerProfileId: row.ownerProfileId,
        ownerUserId: row.ownerUserId,
        threadItemPublicId: row.threadItemPublicId,
      },
    }),
  };
}

function createCursorFromRow(row: SocialFeedRow | undefined): FeedCursor {
  if (row === undefined) {
    throw new Error("cannot create a feed cursor without a row");
  }

  return {
    publishedAt: getFeedSortDate(row).toISOString(),
    createdAt: row.createdAt.toISOString(),
    publicId: row.threadItemPublicId,
  };
}

function isVisibleFeedRow(row: SocialFeedRow) {
  return (
    row.threadStatus === "published" &&
    row.itemStatus === "published" &&
    row.itemDeletedAt === null &&
    row.ownerIsActive &&
    row.ownerUserDeletedAt === null &&
    !row.blockedByOwner
  );
}

function getPublicQuestionText(row: SocialFeedRow) {
  if (
    row.questionTextMode === "hidden" ||
    row.questionDeletedAt !== null ||
    row.questionStatus !== "answered"
  ) {
    return null;
  }

  return row.displayQuestionText;
}

function getPublicAsker(row: SocialFeedRow, questionText: string | null) {
  if (
    questionText === null ||
    row.identityMode !== "account_attributed" ||
    row.askerDisplayName === null ||
    row.askerUsername === null
  ) {
    return undefined;
  }

  return {
    displayName: row.askerDisplayName,
    username: row.askerUsername,
  };
}

function compareFeedRows(left: SocialFeedRow, right: SocialFeedRow) {
  const publishedOrder =
    getFeedSortDate(right).getTime() - getFeedSortDate(left).getTime();

  if (publishedOrder !== 0) {
    return publishedOrder;
  }

  const createdOrder = right.createdAt.getTime() - left.createdAt.getTime();

  if (createdOrder !== 0) {
    return createdOrder;
  }

  return right.threadItemPublicId.localeCompare(left.threadItemPublicId);
}

function getFeedSortDate(row: SocialFeedRow) {
  return row.publishedAt ?? row.createdAt;
}
