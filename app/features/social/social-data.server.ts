import { and, eq, inArray, sql } from "drizzle-orm";

import { getRuntimeDatabase, type RuntimeDatabase } from "~/db/client.server";
import { follows, likes } from "~/db/schema";

export interface ThreadItemLikeSummary {
  threadItemId: string;
  count: number;
  isLikedByViewer: boolean;
}

export interface PublicProfileSocialStats {
  followerCount: number;
  followingCount: number;
  isFollowedByViewer: boolean;
}

export async function findThreadItemLikeSummaries({
  database = getRuntimeDatabase(),
  threadItemIds,
  viewerProfileId,
}: {
  threadItemIds: readonly string[];
  viewerProfileId: string | undefined;
  database?: RuntimeDatabase;
}): Promise<Map<string, ThreadItemLikeSummary>> {
  const summaries = createEmptyLikeSummaryMap(threadItemIds);

  if (threadItemIds.length === 0) {
    return summaries;
  }

  const rows = await database
    .select({
      threadItemId: likes.threadItemId,
      count: sql<number>`count(*)::int`,
      viewerLikeCount:
        viewerProfileId === undefined
          ? sql<number>`0`
          : sql<number>`count(*) filter (where ${likes.profileId} = ${viewerProfileId})::int`,
    })
    .from(likes)
    .where(inArray(likes.threadItemId, [...threadItemIds]))
    .groupBy(likes.threadItemId);

  for (const row of rows) {
    summaries.set(row.threadItemId, {
      threadItemId: row.threadItemId,
      count: row.count,
      isLikedByViewer: row.viewerLikeCount > 0,
    });
  }

  return summaries;
}

export async function findPublicProfileSocialStats({
  database = getRuntimeDatabase(),
  profileId,
  viewerProfileId,
}: {
  profileId: string;
  viewerProfileId: string | undefined;
  database?: RuntimeDatabase;
}): Promise<PublicProfileSocialStats> {
  const [followers, following, viewerFollow] = await Promise.all([
    countFollowers({ database, profileId }),
    countFollowing({ database, profileId }),
    findViewerFollow({ database, profileId, viewerProfileId }),
  ]);

  return {
    followerCount: followers,
    followingCount: following,
    isFollowedByViewer: viewerFollow,
  };
}

function createEmptyLikeSummaryMap(threadItemIds: readonly string[]) {
  return new Map(
    threadItemIds.map((threadItemId) => [
      threadItemId,
      {
        threadItemId,
        count: 0,
        isLikedByViewer: false,
      },
    ]),
  );
}

async function countFollowers({
  database,
  profileId,
}: {
  database: RuntimeDatabase;
  profileId: string;
}) {
  const [row] = await database
    .select({ count: sql<number>`count(*)::int` })
    .from(follows)
    .where(eq(follows.followedProfileId, profileId));

  return row?.count ?? 0;
}

async function countFollowing({
  database,
  profileId,
}: {
  database: RuntimeDatabase;
  profileId: string;
}) {
  const [row] = await database
    .select({ count: sql<number>`count(*)::int` })
    .from(follows)
    .where(eq(follows.followerProfileId, profileId));

  return row?.count ?? 0;
}

async function findViewerFollow({
  database,
  profileId,
  viewerProfileId,
}: {
  database: RuntimeDatabase;
  profileId: string;
  viewerProfileId: string | undefined;
}) {
  if (viewerProfileId === undefined) {
    return false;
  }

  const [row] = await database
    .select({ followedProfileId: follows.followedProfileId })
    .from(follows)
    .where(
      and(
        eq(follows.followerProfileId, viewerProfileId),
        eq(follows.followedProfileId, profileId),
      ),
    )
    .limit(1);

  return row !== undefined;
}
