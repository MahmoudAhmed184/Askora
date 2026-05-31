import { and, desc, eq, inArray, isNull } from "drizzle-orm";

import { getRuntimeDatabase, type RuntimeDatabase } from "~/db/client.server";
import { questions } from "~/db/schema";
import type { CompletedProfileSessionSummary } from "~/features/auth/auth.server";

export const inboxFolderValues = ["inbox", "filtered"] as const;

export type InboxFolder = (typeof inboxFolderValues)[number];
export type InboxQuestionStatus = InboxFolder | "draft" | "answered";
export type InboxQuestionIdentity =
  | "guest_anonymous"
  | "account_anonymous"
  | "account_attributed";

export interface StoredInboxQuestion {
  id: string;
  publicId: string;
  recipientProfileId: string;
  recipientUserId: string;
  identityMode: InboxQuestionIdentity;
  status: InboxQuestionStatus;
  originalText: string;
  deletedAt: Date | null;
  createdAt: Date;
}

export interface InboxQuestionView {
  publicId: string;
  text: string;
  identity: "anonymous" | "attributed";
  createdAt: string;
}

export interface InboxDashboardViewData {
  profile: {
    username: string;
    displayName: string;
  };
  counts: Record<InboxFolder, number>;
}

export interface InboxFolderViewData {
  folder: InboxFolder;
  questions: InboxQuestionView[];
}

export interface InboxLoaderStore {
  findQuestionsForOwner(params: {
    profileId: string;
    userId: string;
    statuses: readonly InboxFolder[];
  }): Promise<StoredInboxQuestion[]>;
}

export async function loadInboxDashboard({
  session,
  store = createDrizzleInboxLoaderStore(),
}: {
  session: CompletedProfileSessionSummary;
  store?: InboxLoaderStore;
}): Promise<InboxDashboardViewData> {
  const visibleQuestions = await findVisibleOwnerQuestions({
    session,
    statuses: inboxFolderValues,
    store,
  });

  return {
    profile: {
      username: session.profile.username,
      displayName: session.profile.displayName,
    },
    counts: {
      inbox: visibleQuestions.filter((question) => question.status === "inbox")
        .length,
      filtered: visibleQuestions.filter(
        (question) => question.status === "filtered",
      ).length,
    },
  };
}

export async function loadInboxFolder({
  folder,
  session,
  store = createDrizzleInboxLoaderStore(),
}: {
  folder: InboxFolder;
  session: CompletedProfileSessionSummary;
  store?: InboxLoaderStore;
}): Promise<InboxFolderViewData> {
  const visibleQuestions = await findVisibleOwnerQuestions({
    session,
    statuses: [folder],
    store,
  });

  return {
    folder,
    questions: visibleQuestions
      .filter((question) => question.status === folder)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
      .map(toInboxQuestionView),
  };
}

export function createDrizzleInboxLoaderStore(
  database: RuntimeDatabase = getRuntimeDatabase(),
): InboxLoaderStore {
  return {
    async findQuestionsForOwner({ profileId, userId, statuses }) {
      const rows = await database
        .select({
          id: questions.id,
          publicId: questions.publicId,
          recipientProfileId: questions.recipientProfileId,
          recipientUserId: questions.recipientUserId,
          identityMode: questions.identityMode,
          status: questions.status,
          originalText: questions.originalText,
          deletedAt: questions.deletedAt,
          createdAt: questions.createdAt,
        })
        .from(questions)
        .where(
          and(
            eq(questions.recipientProfileId, profileId),
            eq(questions.recipientUserId, userId),
            inArray(questions.status, [...statuses]),
            isNull(questions.deletedAt),
          ),
        )
        .orderBy(desc(questions.createdAt));

      return rows;
    },
  };
}

async function findVisibleOwnerQuestions({
  session,
  statuses,
  store,
}: {
  session: CompletedProfileSessionSummary;
  statuses: readonly InboxFolder[];
  store: InboxLoaderStore;
}) {
  const questions = await store.findQuestionsForOwner({
    profileId: session.profile.id,
    userId: session.user.id,
    statuses,
  });

  return questions.filter(
    (question) =>
      question.recipientProfileId === session.profile.id &&
      question.recipientUserId === session.user.id &&
      question.deletedAt === null &&
      isInboxFolder(question.status) &&
      statuses.includes(question.status),
  );
}

function toInboxQuestionView(question: StoredInboxQuestion): InboxQuestionView {
  return {
    publicId: question.publicId,
    text: question.originalText,
    identity:
      question.identityMode === "account_attributed"
        ? "attributed"
        : "anonymous",
    createdAt: question.createdAt.toISOString(),
  };
}

function isInboxFolder(status: InboxQuestionStatus): status is InboxFolder {
  return inboxFolderValues.includes(status as InboxFolder);
}
