import { eq } from "drizzle-orm";

import { getRuntimeDatabase, type RuntimeDatabase } from "~/db/client.server";
import { questions } from "~/db/schema";
import type { AuthenticatedSessionSummary } from "~/features/auth/auth.server";
import type { QuestionIdentityMode } from "~/features/profiles/ask-permissions.server";

export interface RegretQuestion {
  id: string;
  publicId: string;
  askerUserId: string | null;
  identityMode: QuestionIdentityMode;
  status: "inbox" | "filtered" | "draft" | "answered";
  deletedAt: Date | null;
}

export interface AskerRegretStore {
  findQuestionForRegret(publicId: string): Promise<RegretQuestion | undefined>;
  anonymizeQuestion(questionId: string, now: Date): Promise<void>;
  deleteQuestionByAsker(questionId: string, now: Date): Promise<void>;
}

export type AskerRegretResult =
  | {
      status: "updated";
    }
  | AskerRegretDeniedResult;

interface AskerRegretDeniedResult {
  status: "denied";
  reason:
    | "not_found"
    | "suspended"
    | "not_owner"
    | "not_attributed"
    | "closed"
    | "already_deleted";
}

export async function anonymizeOwnQuestion({
  now = new Date(),
  publicId,
  session,
  store = createDrizzleAskerRegretStore(),
}: {
  publicId: string;
  session: AuthenticatedSessionSummary;
  store?: AskerRegretStore;
  now?: Date;
}): Promise<AskerRegretResult> {
  const question = await getRegretQuestion({ publicId, session, store });

  if (question.status === "denied") {
    return question;
  }

  if (question.question.identityMode !== "account_attributed") {
    return { status: "denied", reason: "not_attributed" };
  }

  await store.anonymizeQuestion(question.question.id, now);

  return { status: "updated" };
}

export async function deleteOwnQuestion({
  now = new Date(),
  publicId,
  session,
  store = createDrizzleAskerRegretStore(),
}: {
  publicId: string;
  session: AuthenticatedSessionSummary;
  store?: AskerRegretStore;
  now?: Date;
}): Promise<AskerRegretResult> {
  const question = await getRegretQuestion({ publicId, session, store });

  if (question.status === "denied") {
    return question;
  }

  await store.deleteQuestionByAsker(question.question.id, now);

  return { status: "updated" };
}

export function createDrizzleAskerRegretStore(
  database: RuntimeDatabase = getRuntimeDatabase(),
): AskerRegretStore {
  return {
    async findQuestionForRegret(publicId) {
      const [question] = await database
        .select({
          id: questions.id,
          publicId: questions.publicId,
          askerUserId: questions.askerUserId,
          identityMode: questions.identityMode,
          status: questions.status,
          deletedAt: questions.deletedAt,
        })
        .from(questions)
        .where(eq(questions.publicId, publicId))
        .limit(1);

      return question;
    },
    async anonymizeQuestion(questionId, now) {
      await database
        .update(questions)
        .set({
          identityMode: "account_anonymous",
          askerProfileId: null,
          anonymizedAt: now,
          updatedAt: now,
        })
        .where(eq(questions.id, questionId));
    },
    async deleteQuestionByAsker(questionId, now) {
      await database
        .update(questions)
        .set({
          deletedAt: now,
          deletedBy: "asker",
          updatedAt: now,
        })
        .where(eq(questions.id, questionId));
    },
  };
}

async function getRegretQuestion({
  publicId,
  session,
  store,
}: {
  publicId: string;
  session: AuthenticatedSessionSummary;
  store: AskerRegretStore;
}): Promise<
  | {
      status: "allowed";
      question: RegretQuestion;
    }
  | AskerRegretDeniedResult
> {
  if (session.suspensionStatus === "active") {
    return { status: "denied", reason: "suspended" };
  }

  const question = await store.findQuestionForRegret(publicId);

  if (question === undefined) {
    return { status: "denied", reason: "not_found" };
  }

  if (question.askerUserId !== session.user.id) {
    return { status: "denied", reason: "not_owner" };
  }

  if (question.deletedAt !== null) {
    return { status: "denied", reason: "already_deleted" };
  }

  if (!isRegretWindowOpen(question)) {
    return { status: "denied", reason: "closed" };
  }

  return {
    status: "allowed",
    question,
  };
}

function isRegretWindowOpen(question: RegretQuestion) {
  return question.status === "inbox" || question.status === "filtered";
}
