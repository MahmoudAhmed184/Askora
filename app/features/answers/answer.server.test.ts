import { describe, expect, it } from "vitest";

import {
  createPublicPublishedAnswers,
  handleAnswerSubmission,
  loadAnswerEditor,
  loadDraftAnswers,
  type AnswerMutationParams,
  type AnswerStore,
  type AnswerWorkflowQuestion,
  type PublicPublishedAnswerRow,
  type StoredAnswerDraftItem,
  type StoredDraftAnswerQuestion,
} from "~/features/answers/answer.server";
import type { QuestionTextMode } from "~/features/answers/answer.schema";
import type { CompletedProfileSessionSummary } from "~/features/auth/auth.server";
import type { FollowUpPermission } from "~/features/settings/settings.schema";

const now = new Date("2026-05-31T12:00:00.000Z");

describe("answer workflows", () => {
  it("creates a private draft thread/item, moves the question to draft, and does not notify", async () => {
    const answers = createAnswerStore();

    const result = await submitAnswer({
      formData: createAnswerFormData({
        intent: "save_draft",
        answerText: "  Draft answer\nwith a second line  ",
      }),
      store: answers.store,
    });

    expect(result).toEqual({
      status: "draft_saved",
      questionPublicId: "qst_1",
    });
    expect(answers.question.status).toBe("draft");
    expect(answers.question.threadId).toBe("thread_id_1");
    expect(answers.thread).toMatchObject({
      id: "thread_id_1",
      publicId: "thr_1",
      status: "draft",
      followUpPermissionOverride: null,
      publishedAt: null,
    });
    expect(answers.item).toMatchObject({
      id: "item_id_1",
      publicId: "titem_1",
      answerText: "Draft answer\nwith a second line",
      displayQuestionText: "What should I read next?",
      questionTextMode: "original",
      status: "draft",
      publishedAt: null,
    });
    expect(answers.notifications).toEqual([]);
  });

  it("publishes a thread/item and moves the question to answered", async () => {
    const answers = createAnswerStore();

    const result = await submitAnswer({
      formData: createAnswerFormData({
        intent: "publish",
        answerText: "Published answer",
      }),
      store: answers.store,
    });

    expect(result).toMatchObject({
      status: "published",
      questionPublicId: "qst_1",
      redirectTo: "/person#published-answers",
    });
    expect(answers.question.status).toBe("answered");
    expect(answers.question.threadId).toBe("thread_id_1");
    expect(answers.thread).toMatchObject({
      status: "published",
      publishedAt: now,
    });
    expect(answers.item).toMatchObject({
      answerText: "Published answer",
      status: "published",
      publishedAt: now,
    });
  });

  it("notifies an account-backed asker exactly once on first publish", async () => {
    const answers = createAnswerStore({
      question: createQuestion({
        askerUserId: "asker_user_1",
        askerProfileId: "asker_profile_1",
        identityMode: "account_anonymous",
      }),
    });

    await expect(
      submitAnswer({
        formData: createAnswerFormData({
          intent: "publish",
          answerText: "Published answer",
        }),
        store: answers.store,
      }),
    ).resolves.toMatchObject({
      status: "published",
      notified: true,
    });
    await expect(
      submitAnswer({
        formData: createAnswerFormData({
          intent: "publish",
          answerText: "Published again",
        }),
        store: answers.store,
      }),
    ).resolves.toMatchObject({
      status: "denied",
      reason: "closed",
    });

    expect(answers.notifications).toEqual([
      {
        id: "notification_id_1",
        recipientUserId: "asker_user_1",
        type: "question_answered",
        actorUserId: "user_1",
        threadId: "thread_id_1",
        threadItemId: "item_id_1",
        questionId: "question_1",
        readAt: null,
        createdAt: now,
        expiresAt: new Date("2026-11-27T12:00:00.000Z"),
      },
    ]);
  });

  it("does not notify guest askers", async () => {
    const answers = createAnswerStore();

    await submitAnswer({
      formData: createAnswerFormData({
        intent: "publish",
        answerText: "Published answer",
      }),
      store: answers.store,
    });

    expect(answers.notifications).toEqual([]);
  });

  it("rejects other-owner and deleted questions without leaking existence", async () => {
    const otherOwner = createAnswerStore({
      question: createQuestion({ recipientProfileId: "profile_other" }),
    });

    await expect(
      loadAnswerEditor({
        questionPublicId: "qst_1",
        session: completedSession,
        store: otherOwner.store,
      }),
    ).resolves.toEqual({
      status: "not_found",
    });
    await expect(
      submitAnswer({
        formData: createAnswerFormData({
          intent: "save_draft",
          answerText: "Draft answer",
        }),
        store: otherOwner.store,
      }),
    ).resolves.toMatchObject({
      status: "denied",
      reason: "not_found",
    });

    const deleted = createAnswerStore({
      question: createQuestion({ deletedAt: now }),
    });

    await expect(
      loadAnswerEditor({
        questionPublicId: "qst_1",
        session: completedSession,
        store: deleted.store,
      }),
    ).resolves.toEqual({
      status: "not_found",
    });
    await expect(
      submitAnswer({
        formData: createAnswerFormData({
          intent: "publish",
          answerText: "Published answer",
        }),
        store: deleted.store,
      }),
    ).resolves.toMatchObject({
      status: "denied",
      reason: "not_found",
    });
  });

  it("stores edited public question text and stores no public text for hidden mode", async () => {
    const edited = createAnswerStore();

    await submitAnswer({
      formData: createAnswerFormData({
        intent: "publish",
        answerText: "Edited answer",
        questionTextMode: "edited",
        editedQuestionText: "What book should I start with?",
      }),
      store: edited.store,
    });

    expect(edited.item).toMatchObject({
      displayQuestionText: "What book should I start with?",
      questionTextMode: "edited",
    });

    const hidden = createAnswerStore();

    await submitAnswer({
      formData: createAnswerFormData({
        intent: "publish",
        answerText: "Hidden question answer",
        questionTextMode: "hidden",
      }),
      store: hidden.store,
    });

    expect(hidden.item).toMatchObject({
      displayQuestionText: null,
      questionTextMode: "hidden",
    });
  });
});

describe("loadDraftAnswers", () => {
  it("lists recipient-owned draft answer previews newest-first", async () => {
    const answers = createAnswerStore();

    await submitAnswer({
      formData: createAnswerFormData({
        intent: "save_draft",
        answerText: "Draft answer ".repeat(20),
      }),
      store: answers.store,
    });

    const drafts = await loadDraftAnswers({
      session: completedSession,
      store: answers.store,
    });

    expect(drafts).toEqual({
      profile: {
        username: "person",
        displayName: "Person",
      },
      drafts: [
        {
          questionPublicId: "qst_1",
          questionText: "What should I read next?",
          answerPreview:
            "Draft answer Draft answer Draft answer Draft answer Draft answer Draft answer Draft answer Draft answer Draft answer Draft answer Draft answer Draft answer D...",
          updatedAt: "2026-05-31T12:00:00.000Z",
          questionCreatedAt: "2026-05-31T12:00:00.000Z",
        },
      ],
    });
  });
});

describe("createPublicPublishedAnswers", () => {
  it("orders pinned answers first by position before newest unpinned answers", () => {
    const answers = createPublicPublishedAnswers([
      createPublicAnswerRow({
        publicId: "new_unpinned",
        publishedAt: new Date("2026-05-31T12:00:00.000Z"),
      }),
      createPublicAnswerRow({
        publicId: "pinned_second",
        pinPosition: 2,
        publishedAt: new Date("2026-05-20T12:00:00.000Z"),
      }),
      createPublicAnswerRow({
        publicId: "old_unpinned",
        publishedAt: new Date("2026-05-01T12:00:00.000Z"),
      }),
      createPublicAnswerRow({
        publicId: "pinned_first",
        pinPosition: 1,
        publishedAt: new Date("2026-05-10T12:00:00.000Z"),
      }),
    ]);

    expect(answers.map((answer) => answer.publicId)).toEqual([
      "pinned_first",
      "pinned_second",
      "new_unpinned",
      "old_unpinned",
    ]);
  });

  it("omits hidden/deleted/unpublished question and answer text from public data", () => {
    const answers = createPublicPublishedAnswers([
      createPublicAnswerRow({
        publicId: "visible",
        answerText: "Visible answer",
        displayQuestionText: "Visible question",
      }),
      createPublicAnswerRow({
        publicId: "hidden_question",
        displayQuestionText: "Secret question",
        questionTextMode: "hidden",
      }),
      createPublicAnswerRow({
        publicId: "deleted_question",
        displayQuestionText: "Deleted question",
        questionDeletedAt: now,
      }),
      createPublicAnswerRow({
        publicId: "draft_question",
        displayQuestionText: "Draft question",
        questionStatus: "draft",
      }),
      createPublicAnswerRow({
        publicId: "deleted_answer",
        answerText: "Deleted answer",
        itemDeletedAt: now,
        itemStatus: "deleted",
      }),
      createPublicAnswerRow({
        publicId: "unpublished_answer",
        answerText: "Unpublished answer",
        itemStatus: "unpublished",
      }),
      createPublicAnswerRow({
        publicId: "unpublished_thread",
        answerText: "Thread hidden answer",
        threadStatus: "unpublished",
      }),
    ]);
    const serializedAnswers = JSON.stringify(answers);

    expect(answers).toEqual([
      expect.objectContaining({
        publicId: "visible",
        answerText: "Visible answer",
        questionText: "Visible question",
      }),
      expect.objectContaining({
        publicId: "hidden_question",
        questionText: null,
      }),
      expect.objectContaining({
        publicId: "deleted_question",
        questionText: null,
      }),
      expect.objectContaining({
        publicId: "draft_question",
        questionText: null,
      }),
    ]);
    expect(serializedAnswers).not.toContain("Secret question");
    expect(serializedAnswers).not.toContain("Deleted question");
    expect(serializedAnswers).not.toContain("Draft question");
    expect(serializedAnswers).not.toContain("Deleted answer");
    expect(serializedAnswers).not.toContain("Unpublished answer");
    expect(serializedAnswers).not.toContain("Thread hidden answer");
  });
});

async function submitAnswer({
  formData,
  session = completedSession,
  store,
}: {
  formData: FormData;
  session?: CompletedProfileSessionSummary;
  store: AnswerStore;
}) {
  const ids = ["thread_id_1", "item_id_1", "notification_id_1"];
  const threadPublicIds = ["thr_1"];
  const itemPublicIds = ["titem_1"];

  return handleAnswerSubmission({
    createId: () => ids.shift() ?? "extra_id",
    createThreadItemPublicId: () => itemPublicIds.shift() ?? "titem_extra",
    createThreadPublicId: () => threadPublicIds.shift() ?? "thr_extra",
    formData,
    now,
    questionPublicId: "qst_1",
    session,
    store,
  });
}

function createAnswerFormData({
  answerText,
  editedQuestionText = "",
  followUpPermissionOverride = "",
  intent,
  questionTextMode = "original",
}: {
  answerText: string;
  editedQuestionText?: string;
  followUpPermissionOverride?: string;
  intent: "save_draft" | "publish";
  questionTextMode?: QuestionTextMode;
}) {
  const formData = new FormData();

  formData.set("intent", intent);
  formData.set("answerText", answerText);
  formData.set("questionTextMode", questionTextMode);
  formData.set("editedQuestionText", editedQuestionText);
  formData.set("followUpPermissionOverride", followUpPermissionOverride);

  return formData;
}

function createPublicAnswerRow(
  overrides: Partial<PublicPublishedAnswerRow> = {},
): PublicPublishedAnswerRow {
  return {
    publicId: "titem_1",
    answerText: "Published answer",
    itemStatus: "published",
    itemDeletedAt: null,
    publishedAt: now,
    createdAt: now,
    pinPosition: null,
    threadStatus: "published",
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

interface TestThread {
  id: string;
  publicId: string;
  status: "draft" | "published" | "unpublished" | "deleted";
  followUpPermissionOverride: FollowUpPermission | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface TestThreadItem {
  id: string;
  publicId: string;
  threadId: string;
  questionId: string;
  answerText: string;
  displayQuestionText: string | null;
  questionTextMode: QuestionTextMode;
  status: "draft" | "published" | "unpublished" | "deleted";
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface TestNotification {
  id: string;
  recipientUserId: string;
  type: "question_answered";
  actorUserId: string;
  threadId: string;
  threadItemId: string;
  questionId: string;
  readAt: Date | null;
  createdAt: Date;
  expiresAt: Date;
}

function createAnswerStore({
  question = createQuestion(),
}: {
  question?: AnswerWorkflowQuestion;
} = {}) {
  let thread: TestThread | undefined;
  let item: TestThreadItem | undefined;
  const notifications: TestNotification[] = [];

  const store: AnswerStore = {
    findQuestionForAnswer(publicId) {
      return Promise.resolve(question.publicId === publicId ? question : undefined);
    },
    findDraftItemByQuestionId(questionId) {
      if (item?.questionId !== questionId || item.status !== "draft") {
        return Promise.resolve(undefined);
      }

      return Promise.resolve({
        id: item.id,
        answerText: item.answerText,
        displayQuestionText: item.displayQuestionText,
        questionTextMode: item.questionTextMode,
        followUpPermissionOverride: thread?.followUpPermissionOverride ?? null,
        updatedAt: item.updatedAt,
      } satisfies StoredAnswerDraftItem);
    },
    findDraftAnswerQuestionsForOwner({ profileId, userId }) {
      if (
        item === undefined ||
        question.recipientProfileId !== profileId ||
        question.recipientUserId !== userId ||
        question.status !== "draft" ||
        item.status !== "draft"
      ) {
        return Promise.resolve([]);
      }

      return Promise.resolve([
        {
          questionId: question.id,
          questionPublicId: question.publicId,
          recipientProfileId: question.recipientProfileId,
          recipientUserId: question.recipientUserId,
          questionText: question.originalText,
          answerText: item.answerText,
          itemUpdatedAt: item.updatedAt,
          questionCreatedAt: question.createdAt,
          deletedAt: question.deletedAt,
          status: question.status,
        } satisfies StoredDraftAnswerQuestion,
      ]);
    },
    saveDraftAnswer(params) {
      const draft = upsertAnswerState({
        item,
        params,
        publish: false,
        thread,
      });
      thread = draft.thread;
      item = draft.item;
      question.status = "draft";
      question.threadId = thread.id;
      return Promise.resolve();
    },
    publishAnswer(params) {
      const previousStatus = item?.status;
      const published = upsertAnswerState({
        item,
        params,
        publish: true,
        thread,
      });
      thread = published.thread;
      item = published.item;
      question.status = "answered";
      question.threadId = thread.id;

      const firstPublish = previousStatus !== "published";

      if (
        firstPublish &&
        question.askerUserId !== null &&
        !notifications.some(
          (notification) =>
            notification.recipientUserId === question.askerUserId &&
            notification.questionId === question.id,
        )
      ) {
        notifications.push({
          id: params.createDatabaseId(),
          recipientUserId: question.askerUserId,
          type: "question_answered",
          actorUserId: params.actorUserId,
          threadId: thread.id,
          threadItemId: item.id,
          questionId: question.id,
          readAt: null,
          createdAt: params.now,
          expiresAt: addDays(params.now, 180),
        });
      }

      return Promise.resolve({
        notified: firstPublish && question.askerUserId !== null,
      });
    },
  };

  return {
    get item() {
      return item;
    },
    notifications,
    question,
    store,
    get thread() {
      return thread;
    },
  };
}

function upsertAnswerState({
  item,
  params,
  publish,
  thread,
}: {
  item: TestThreadItem | undefined;
  params: AnswerMutationParams;
  publish: boolean;
  thread: TestThread | undefined;
}) {
  const nextThread =
    thread ??
    ({
      id: params.createDatabaseId(),
      publicId: params.createThreadPublicId(),
      status: "draft",
      followUpPermissionOverride: null,
      publishedAt: null,
      createdAt: params.now,
      updatedAt: params.now,
    } satisfies TestThread);
  const status = publish ? "published" : "draft";
  const publishedAt = publish
    ? (nextThread.publishedAt ?? params.now)
    : nextThread.publishedAt;

  nextThread.status = status;
  nextThread.followUpPermissionOverride =
    params.submission.followUpPermissionOverride;
  nextThread.publishedAt = publishedAt;
  nextThread.updatedAt = params.now;

  const nextItem =
    item ??
    ({
      id: params.createDatabaseId(),
      publicId: params.createThreadItemPublicId(),
      threadId: nextThread.id,
      questionId: params.question.id,
      answerText: "",
      displayQuestionText: null,
      questionTextMode: "original",
      status: "draft",
      publishedAt: null,
      createdAt: params.now,
      updatedAt: params.now,
    } satisfies TestThreadItem);

  nextItem.answerText = params.submission.answerText;
  nextItem.displayQuestionText = getDisplayQuestionText(params);
  nextItem.questionTextMode = params.submission.questionTextMode;
  nextItem.status = status;
  nextItem.publishedAt = publish
    ? (nextItem.publishedAt ?? params.now)
    : nextItem.publishedAt;
  nextItem.updatedAt = params.now;

  return {
    item: nextItem,
    thread: nextThread,
  };
}

function getDisplayQuestionText(params: AnswerMutationParams) {
  if (params.submission.questionTextMode === "hidden") {
    return null;
  }

  if (params.submission.questionTextMode === "edited") {
    return params.submission.editedQuestionText ?? "";
  }

  return params.question.originalText;
}

function createQuestion(
  overrides: Partial<AnswerWorkflowQuestion> = {},
): AnswerWorkflowQuestion {
  return {
    id: "question_1",
    publicId: "qst_1",
    recipientProfileId: "profile_1",
    recipientUserId: "user_1",
    askerUserId: null,
    askerProfileId: null,
    identityMode: "guest_anonymous",
    status: "inbox",
    originalText: "What should I read next?",
    deletedAt: null,
    createdAt: now,
    threadId: null,
    followUpPermissionDefault: "anyone",
    ...overrides,
  };
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
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
