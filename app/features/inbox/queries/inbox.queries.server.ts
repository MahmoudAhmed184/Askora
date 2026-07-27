import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { getRuntimeDatabase, type RuntimeDatabase } from "~/db/client.server";
import { profiles, questions } from "~/db/schema";
import type { CompletedProfileSessionSummary } from "~/features/auth/services/auth.service.server";

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
  askerDisplayName?: string | null;
  askerUsername?: string | null;
  askerAvatarUrl?: string | null;
}

export interface InboxQuestionSenderView {
  displayName: string;
  username: string;
  avatarUrl: string | null;
}

export interface InboxQuestionView {
  publicId: string;
  text: string;
  identity: "anonymous" | "attributed";
  createdAt: string;
  sender?: InboxQuestionSenderView;
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
      .sort(
        (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
      )
      .map(toInboxQuestionView),
  };
}

export function createDrizzleInboxLoaderStore(
  database: RuntimeDatabase = getRuntimeDatabase(),
): InboxLoaderStore {
  return {
    async findQuestionsForOwner({ profileId, userId, statuses }) {
      const askerProfiles = alias(profiles, "inbox_asker_profiles");
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
          askerDisplayName: askerProfiles.displayName,
          askerUsername: askerProfiles.username,
          askerAvatarUrl: askerProfiles.avatarUrl,
        })
        .from(questions)
        .leftJoin(
          askerProfiles,
          and(
            eq(questions.identityMode, "account_attributed"),
            eq(askerProfiles.id, questions.askerProfileId),
          ),
        )
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
  const isAttributed = question.identityMode === "account_attributed";

  return {
    publicId: question.publicId,
    text: question.originalText,
    identity: isAttributed ? "attributed" : "anonymous",
    createdAt: question.createdAt.toISOString(),
    ...getInboxQuestionSender(question),
  };
}

function getInboxQuestionSender(question: StoredInboxQuestion) {
  if (
    question.identityMode !== "account_attributed" ||
    question.askerDisplayName === undefined ||
    question.askerDisplayName === null ||
    question.askerUsername === undefined ||
    question.askerUsername === null
  ) {
    return {};
  }

  return {
    sender: {
      displayName: question.askerDisplayName,
      username: question.askerUsername,
      avatarUrl: question.askerAvatarUrl ?? null,
    },
  };
}

function isInboxFolder(status: InboxQuestionStatus): status is InboxFolder {
  return inboxFolderValues.includes(status as InboxFolder);
}
