import { and, asc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { getRuntimeDatabase, type RuntimeDatabase } from "~/db/client.server";
import {
  authUsers,
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
  initialQuestionId: string;
  publishedAt: Date | null;
}

export interface PublicThreadItemRow {
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
}

export interface PublicThreadStore {
  findThreadByPublicId(
    threadPublicId: string,
  ): Promise<PublicThreadRecord | undefined>;
  findThreadItems(threadId: string): Promise<PublicThreadItemRow[]>;
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
      publishedAnswerControls: PublishedAnswerControlState;
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

  const rows = await store.findThreadItems(thread.id);
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
        rows,
      }),
      publishedAnswerControls: getPublishedAnswerControlState({
        owner: {
          id: thread.ownerProfileId,
          userId: thread.ownerUserId,
        },
        session,
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
          initialQuestionId: threads.initialQuestionId,
          publishedAt: threads.publishedAt,
        })
        .from(threads)
        .innerJoin(profiles, eq(profiles.id, threads.ownerProfileId))
        .leftJoin(authUsers, eq(authUsers.id, profiles.userId))
        .where(eq(threads.publicId, threadPublicId))
        .limit(1);

      return thread;
    },
    async findThreadItems(threadId) {
      const askerProfiles = alias(profiles, "thread_asker_profiles");

      return database
        .select({
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
    },
  };
}

export function createPublicThreadItems({
  initialQuestionId,
  rows,
}: {
  initialQuestionId: string;
  rows: PublicThreadItemRow[];
}): PublicThreadItem[] {
  const sortedRows = [...rows].sort(compareThreadItemRows);

  return sortedRows.flatMap((row, index): PublicThreadItem[] => {
    if (isVisiblePublishedThreadItem(row)) {
      return [toPublicThreadAnswerItem(row)];
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

function toPublicThreadAnswerItem(
  row: PublicThreadItemRow,
): PublicThreadAnswerItem {
  const questionText = getPublicQuestionText(row);

  return {
    type: "answer",
    publicId: row.publicId,
    answerText: row.answerText,
    publishedAt: (row.publishedAt ?? new Date(0)).toISOString(),
    pinPosition: row.pinPosition,
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
