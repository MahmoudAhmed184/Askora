import { describe, expect, it } from "vitest";

import {
  createPublicPublishedAnswerPage,
  createPublicPublishedAnswers,
  decodePublicAnswerCursor,
  PUBLIC_PROFILE_ANSWER_PAGE_SIZE,
  handleAnswerSubmission,
  isConcurrentAnswerPublishConflict,
  loadAnswerEditor,
  loadDraftAnswers,
  type AnswerMutationParams,
  type AnswerStore,
  type AnswerWorkflowQuestion,
  type PublicPublishedAnswerRow,
  type StoredAnswerDraftItem,
  type StoredDraftAnswerQuestion
} from "~/features/answers/services/answer.service.server";;
import type { QuestionTextMode } from "~/features/answers/validations/answer.validations";
import type {
  CompletedProfileSessionSummary
} from "~/features/auth/services/auth.service.server";;
import type { FollowUpPermission } from "~/features/settings/validations/settings.validations";
import type {
  PublicThreadItemRow
} from "~/features/threads/queries/public-thread.queries.server";;

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

  it("reopens and republishes an answer restored to draft by unpublish", async () => {
    const answers = createAnswerStore({
      question: createQuestion({
        status: "draft",
        threadId: "thread_id_1",
        threadPublicId: "thr_1",
        threadInitialQuestionId: "question_1",
        threadStatus: "draft",
      }),
      thread: createThread({
        status: "draft",
        initialQuestionId: "question_1",
        publishedAt: null,
      }),
      items: [
        createThreadItem({
          questionId: "question_1",
          status: "draft",
          publishedAt: null,
        }),
      ],
    });

    await expect(
      submitAnswer({
        formData: createAnswerFormData({
          intent: "publish",
          answerText: "Revised public answer",
        }),
        store: answers.store,
      }),
    ).resolves.toMatchObject({ status: "published" });
    expect(answers.question.status).toBe("answered");
    expect(answers.thread?.status).toBe("published");
    expect(answers.item).toMatchObject({
      answerText: "Revised public answer",
      status: "published",
      publishedAt: now,
    });
  });

  it("maps a concurrent duplicate publish to an already-answered denial", async () => {
    const answers = createAnswerStore();
    let publishAttempts = 0;
    const store: AnswerStore = {
      ...answers.store,
      publishAnswer: () => {
        publishAttempts += 1;

        if (publishAttempts === 2) {
          return Promise.reject(createUniqueConstraintError(
            "thread_items_question_id_unique",
          ));
        }

        return Promise.resolve({
          status: "published",
          notified: false,
          threadPublicId: "thr_1",
          threadItemPublicId: "titem_1",
        });
      },
    };

    const results = await Promise.all([
      submitAnswer({
        formData: createAnswerFormData({
          answerText: "Concurrent answer",
          intent: "publish",
        }),
        store,
      }),
      submitAnswer({
        formData: createAnswerFormData({
          answerText: "Concurrent answer",
          intent: "publish",
        }),
        store,
      }),
    ]);

    expect(results.map((result) => result.status).sort()).toEqual([
      "denied",
      "published",
    ]);
    expect(results).toContainEqual(
      expect.objectContaining({
        status: "denied",
        reason: "already_answered",
        formError: "This question was already answered.",
      }),
    );
  });

  it("recognizes only answer ownership unique conflicts, including wrapped errors", () => {
    expect(
      isConcurrentAnswerPublishConflict(
        new Error("transaction failed", {
          cause: createUniqueConstraintError("threads_initial_question_id_unique"),
        }),
      ),
    ).toBe(true);
    expect(
      isConcurrentAnswerPublishConflict(
        createUniqueConstraintError("threads_public_id_unique"),
      ),
    ).toBe(false);
  });

  it("denies suspended sessions before saving or publishing content", async () => {
    for (const intent of ["save_draft", "publish"] as const) {
      const answers = createAnswerStore();

      await expect(
        submitAnswer({
          formData: createAnswerFormData({
            intent,
            answerText: "Suspended account content",
          }),
          session: {
            ...completedSession,
            suspensionStatus: "active",
          },
          store: answers.store,
        }),
      ).resolves.toMatchObject({
        status: "denied",
        reason: "suspended",
      });
      expect(answers.question.status).toBe("inbox");
      expect(answers.item).toBeUndefined();
      expect(answers.thread).toBeUndefined();
    }
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

  it("loads follow-up thread context and preserves the current follow-up override", async () => {
    const answers = createAnswerStore({
      items: [createThreadItem()],
      question: createFollowUpQuestion(),
      thread: createThread({ followUpPermissionOverride: "logged_in" }),
    });

    await expect(
      loadAnswerEditor({
        questionPublicId: "qst_1",
        session: completedSession,
        store: answers.store,
      }),
    ).resolves.toMatchObject({
      status: "found",
      editor: {
        values: {
          followUpPermissionOverride: "logged_in",
        },
        threadContext: {
          totalVisibleItems: 1,
        },
      },
    });
  });

  it("saves follow-up drafts without hiding the published thread", async () => {
    const answers = createAnswerStore({
      items: [createThreadItem()],
      question: createFollowUpQuestion(),
      thread: createThread({ followUpPermissionOverride: "logged_in" }),
    });

    await expect(
      submitAnswer({
        formData: createAnswerFormData({
          intent: "save_draft",
          answerText: "Draft follow-up answer",
          followUpPermissionOverride: "logged_in",
        }),
        ids: ["item_follow_up"],
        store: answers.store,
      }),
    ).resolves.toEqual({
      status: "draft_saved",
      questionPublicId: "qst_1",
    });

    expect(answers.thread).toMatchObject({
      status: "published",
      followUpPermissionOverride: "logged_in",
    });
    expect(answers.item).toMatchObject({
      id: "item_follow_up",
      status: "draft",
      position: 1,
    });
  });

  it("publishes follow-ups at the next position and redirects to the thread anchor", async () => {
    const answers = createAnswerStore({
      items: [createThreadItem()],
      question: createFollowUpQuestion(),
      thread: createThread(),
    });

    const result = await submitAnswer({
      formData: createAnswerFormData({
        intent: "publish",
        answerText: "Follow-up answer",
      }),
      ids: ["item_follow_up"],
      store: answers.store,
    });

    expect(result).toMatchObject({
      status: "published",
      redirectTo: "/person/a/thr_1#item-titem_1",
    });
    expect(answers.item).toMatchObject({
      id: "item_follow_up",
      status: "published",
      position: 1,
    });
    expect(answers.thread).toMatchObject({
      status: "published",
    });
  });

  it("blocks follow-up publishing when the public thread is full", async () => {
    const answers = createAnswerStore({
      items: Array.from({ length: 20 }, (_, index) =>
        createThreadItem({
          id: `item_${String(index)}`,
          publicId: `titem_${String(index)}`,
          questionId: `question_${String(index)}`,
          position: index,
        }),
      ),
      question: createFollowUpQuestion(),
      thread: createThread(),
    });

    await expect(
      submitAnswer({
        formData: createAnswerFormData({
          intent: "publish",
          answerText: "One too many",
        }),
        ids: ["item_follow_up"],
        store: answers.store,
      }),
    ).resolves.toMatchObject({
      status: "denied",
      reason: "thread_full",
    });
    expect(answers.item).toBeUndefined();
  });

  it("notifies the current asker and distinct logged-in thread participants when a follow-up is answered", async () => {
    const answers = createAnswerStore({
      items: [createThreadItem()],
      participantUserIds: [
        "user_initial",
        "user_current",
        "user_1",
        "user_initial",
        "user_other",
      ],
      question: createFollowUpQuestion({
        askerUserId: "user_current",
        askerProfileId: "profile_current",
        identityMode: "account_anonymous",
      }),
      thread: createThread(),
    });

    await submitAnswer({
      formData: createAnswerFormData({
        intent: "publish",
        answerText: "Follow-up answer",
      }),
      ids: [
        "item_follow_up",
        "notification_answered",
        "notification_participant_1",
        "notification_participant_2",
      ],
      store: answers.store,
    });

    expect(answers.notifications).toEqual([
      expect.objectContaining({
        id: "notification_answered",
        recipientUserId: "user_current",
        type: "question_answered",
      }),
      expect.objectContaining({
        id: "notification_participant_1",
        recipientUserId: "user_initial",
        type: "follow_up_answered",
      }),
      expect.objectContaining({
        id: "notification_participant_2",
        recipientUserId: "user_other",
        type: "follow_up_answered",
      }),
    ]);
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

    expect(answers).toHaveLength(4);
    expect(answers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        publicId: "visible",
        threadPublicId: "thr_1",
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
    ]));
    expect(serializedAnswers).not.toContain("Secret question");
    expect(serializedAnswers).not.toContain("Deleted question");
    expect(serializedAnswers).not.toContain("Draft question");
    expect(serializedAnswers).not.toContain("Deleted answer");
    expect(serializedAnswers).not.toContain("Unpublished answer");
    expect(serializedAnswers).not.toContain("Thread hidden answer");
  });
});

describe("createPublicPublishedAnswerPage", () => {
  it("bounds chronological answers while retaining the separately fetched pins", () => {
    const pinned = createPublicAnswerRow({
      publicId: "pinned",
      pinPosition: 1,
    });
    const chronological = Array.from(
      { length: PUBLIC_PROFILE_ANSWER_PAGE_SIZE + 1 },
      (_, index) =>
        createPublicAnswerRow({
          threadItemId: `item_${String(index)}`,
          publicId: `answer_${String(index)}`,
          publishedAt: new Date(Date.UTC(2026, 4, 31 - index, 12)),
          createdAt: new Date(Date.UTC(2026, 4, 31 - index, 11)),
        }),
    );

    const page = createPublicPublishedAnswerPage({
      chronologicalRows: chronological,
      pinnedRows: [pinned],
      totalAnswerCount: 42,
      totalReactionCount: 73,
    });

    expect(page.answers).toHaveLength(PUBLIC_PROFILE_ANSWER_PAGE_SIZE + 1);
    expect(page.answers[0]?.publicId).toBe("pinned");
    expect(page.answers.at(-1)?.publicId).toBe("answer_19");
    expect(page.totalAnswerCount).toBe(42);
    expect(page.totalReactionCount).toBe(73);
    expect(decodePublicAnswerCursor(page.nextCursor)).toEqual({
      publishedAt: new Date(Date.UTC(2026, 4, 12, 12)),
      createdAt: new Date(Date.UTC(2026, 4, 12, 11)),
      publicId: "answer_19",
    });
  });

  it("omits a cursor after the final chronological page", () => {
    const page = createPublicPublishedAnswerPage({
      chronologicalRows: [
        createPublicAnswerRow({
          publicId: "final_answer",
          publishedAt: new Date("2026-05-01T12:00:00.000Z"),
          createdAt: new Date("2026-05-01T11:00:00.000Z"),
        }),
      ],
      pinnedRows: [],
      totalAnswerCount: 1,
      totalReactionCount: 0,
    });

    expect(page.answers.map((answer) => answer.publicId)).toEqual([
      "final_answer",
    ]);
    expect(page.nextCursor).toBeUndefined();
  });
});

async function submitAnswer({
  formData,
  ids = ["thread_id_1", "item_id_1", "notification_id_1"],
  session = completedSession,
  store,
}: {
  formData: FormData;
  ids?: string[];
  session?: CompletedProfileSessionSummary;
  store: AnswerStore;
}) {
  const databaseIds = [...ids];
  const threadPublicIds = ["thr_1"];
  const itemPublicIds = ["titem_1"];

  return handleAnswerSubmission({
    createId: () => databaseIds.shift() ?? "extra_id",
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
    threadItemId: "item_1",
    publicId: "titem_1",
    threadPublicId: "thr_1",
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
    ownerProfileId: "profile_1",
    ownerUserId: "user_1",
    ownerShowLikeCounts: true,
    likeCount: 0,
    viewerLiked: false,
    ...overrides,
  };
}

interface TestThread {
  id: string;
  publicId: string;
  status: "draft" | "published" | "unpublished" | "deleted";
  followUpPermissionOverride: FollowUpPermission | null;
  initialQuestionId: string;
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
  position: number;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface TestNotification {
  id: string;
  recipientUserId: string;
  type: "question_answered" | "follow_up_answered";
  actorUserId: string;
  threadId: string;
  threadItemId: string;
  questionId: string;
  readAt: Date | null;
  createdAt: Date;
  expiresAt: Date;
}

function createAnswerStore({
  participantUserIds = [],
  question = createQuestion(),
  thread: initialThread,
  items: initialItems = [],
}: {
  participantUserIds?: string[];
  question?: AnswerWorkflowQuestion;
  thread?: TestThread;
  items?: TestThreadItem[];
} = {}) {
  let thread = initialThread;
  const items = [...initialItems];
  const notifications: TestNotification[] = [];
  const linkedThread = thread?.id === question.threadId ? thread : undefined;

  if (linkedThread !== undefined) {
    question.threadPublicId = linkedThread.publicId;
    question.threadInitialQuestionId = linkedThread.initialQuestionId;
    question.threadStatus = linkedThread.status;
    question.threadFollowUpPermissionOverride =
      linkedThread.followUpPermissionOverride;
  }

  const store: AnswerStore = {
    findQuestionForAnswer(publicId) {
      return Promise.resolve(question.publicId === publicId ? question : undefined);
    },
    findDraftItemByQuestionId(questionId) {
      const item = findQuestionItem(items, questionId);

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
      const item = findQuestionItem(items, question.id);

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
    findThreadContextRows(threadId) {
      return Promise.resolve(
        items
          .filter((item) => item.threadId === threadId)
          .map((item) => createContextRow(item)),
      );
    },
    saveDraftAnswer(params) {
      const draft = upsertAnswerState({
        items,
        params,
        publish: false,
        thread,
      });
      thread = draft.thread;
      question.status = "draft";
      question.threadId = thread.id;
      question.threadPublicId = thread.publicId;
      question.threadInitialQuestionId = thread.initialQuestionId;
      question.threadStatus = thread.status;
      question.threadFollowUpPermissionOverride =
        thread.followUpPermissionOverride;
      return Promise.resolve();
    },
    publishAnswer(params) {
      const item = findQuestionItem(items, question.id);
      const previousStatus = item?.status;
      const firstPublish = previousStatus !== "published";

      if (
        firstPublish &&
        isTestFollowUpQuestion(question) &&
        countVisiblePublishedItems(items, question.threadId) >= 20
      ) {
        return Promise.resolve({
          status: "denied",
          reason: "thread_full",
        });
      }

      const published = upsertAnswerState({
        items,
        params,
        publish: true,
        thread,
      });
      thread = published.thread;
      question.status = "answered";
      question.threadId = thread.id;
      question.threadPublicId = thread.publicId;
      question.threadInitialQuestionId = thread.initialQuestionId;
      question.threadStatus = thread.status;
      question.threadFollowUpPermissionOverride =
        thread.followUpPermissionOverride;

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
          threadItemId: published.item.id,
          questionId: question.id,
          readAt: null,
          createdAt: params.now,
          expiresAt: addDays(params.now, 180),
        });
      }

      if (firstPublish && isTestFollowUpQuestion(question)) {
        for (const recipientUserId of getParticipantNotificationRecipients({
          actorUserId: params.actorUserId,
          currentAskerUserId: question.askerUserId,
          ownerUserId: question.recipientUserId,
          participantUserIds,
        })) {
          notifications.push({
            id: params.createDatabaseId(),
            recipientUserId,
            type: "follow_up_answered",
            actorUserId: params.actorUserId,
            threadId: thread.id,
            threadItemId: published.item.id,
            questionId: question.id,
            readAt: null,
            createdAt: params.now,
            expiresAt: addDays(params.now, 180),
          });
        }
      }

      return Promise.resolve({
        status: "published",
        notified: firstPublish && question.askerUserId !== null,
        threadPublicId: thread.publicId,
        threadItemPublicId: published.item.publicId,
      });
    },
  };

  return {
    get item() {
      return findQuestionItem(items, question.id);
    },
    items,
    notifications,
    question,
    store,
    get thread() {
      return thread;
    },
  };
}

function upsertAnswerState({
  items,
  params,
  publish,
  thread,
}: {
  items: TestThreadItem[];
  params: AnswerMutationParams;
  publish: boolean;
  thread: TestThread | undefined;
}) {
  const item = findQuestionItem(items, params.question.id);
  const nextThread =
    thread ??
    ({
      id: params.createDatabaseId(),
      publicId: params.createThreadPublicId(),
      status: "draft",
      followUpPermissionOverride: null,
      initialQuestionId: params.question.id,
      publishedAt: null,
      createdAt: params.now,
      updatedAt: params.now,
    } satisfies TestThread);
  const threadStatus =
    thread !== undefined && isTestFollowUpQuestion(params.question)
      ? thread.status
      : publish
        ? "published"
        : "draft";
  const itemStatus = publish ? "published" : "draft";
  const publishedAt = publish
    ? (nextThread.publishedAt ?? params.now)
    : nextThread.publishedAt;

  nextThread.status = threadStatus;
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
      position: isTestFollowUpQuestion(params.question)
        ? getNextItemPosition(items, nextThread.id)
        : 0,
      publishedAt: null,
      createdAt: params.now,
      updatedAt: params.now,
    } satisfies TestThreadItem);

  if (item === undefined) {
    items.push(nextItem);
  }

  nextItem.answerText = params.submission.answerText;
  nextItem.displayQuestionText = getDisplayQuestionText(params);
  nextItem.questionTextMode = params.submission.questionTextMode;
  nextItem.status = itemStatus;
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

function findQuestionItem(items: TestThreadItem[], questionId: string) {
  return items.find((item) => item.questionId === questionId);
}

function getNextItemPosition(items: TestThreadItem[], threadId: string) {
  return Math.max(
    -1,
    ...items
      .filter((item) => item.threadId === threadId)
      .map((item) => item.position),
  ) + 1;
}

function countVisiblePublishedItems(
  items: TestThreadItem[],
  threadId: string | null,
) {
  if (threadId === null) {
    return 0;
  }

  return items.filter(
    (item) => item.threadId === threadId && item.status === "published",
  ).length;
}

function createContextRow(item: TestThreadItem): PublicThreadItemRow {
  return {
    publicId: item.publicId,
    questionId: item.questionId,
    answerText: item.answerText,
    itemStatus: item.status,
    itemDeletedAt: null,
    publishedAt: item.publishedAt,
    createdAt: item.createdAt,
    position: item.position,
    pinPosition: null,
    questionStatus: "answered",
    questionDeletedAt: null,
    questionTextMode: item.questionTextMode,
    displayQuestionText: item.displayQuestionText,
    identityMode: "guest_anonymous",
    askerDisplayName: null,
    askerUsername: null,
  };
}

function getParticipantNotificationRecipients({
  actorUserId,
  currentAskerUserId,
  ownerUserId,
  participantUserIds,
}: {
  participantUserIds: string[];
  ownerUserId: string;
  actorUserId: string;
  currentAskerUserId: string | null;
}) {
  return [
    ...new Set(
      participantUserIds.filter(
        (userId) =>
          userId !== ownerUserId &&
          userId !== actorUserId &&
          userId !== currentAskerUserId,
      ),
    ),
  ];
}

function isTestFollowUpQuestion(question: AnswerWorkflowQuestion) {
  return (
    question.threadId !== null &&
    question.threadInitialQuestionId !== question.id
  );
}

function createThread(overrides: Partial<TestThread> = {}): TestThread {
  return {
    id: "thread_id_1",
    publicId: "thr_1",
    status: "published",
    followUpPermissionOverride: null,
    initialQuestionId: "question_initial",
    publishedAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createThreadItem(
  overrides: Partial<TestThreadItem> = {},
): TestThreadItem {
  return {
    id: "item_initial",
    publicId: "titem_initial",
    threadId: "thread_id_1",
    questionId: "question_initial",
    answerText: "Initial answer",
    displayQuestionText: "Initial question?",
    questionTextMode: "original",
    status: "published",
    position: 0,
    publishedAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
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
    threadPublicId: null,
    threadInitialQuestionId: null,
    threadStatus: null,
    threadFollowUpPermissionOverride: null,
    followUpPermissionDefault: "anyone",
    ...overrides,
  };
}

function createFollowUpQuestion(
  overrides: Partial<AnswerWorkflowQuestion> = {},
): AnswerWorkflowQuestion {
  return createQuestion({
    id: "question_follow_up",
    threadId: "thread_id_1",
    threadPublicId: "thr_1",
    threadInitialQuestionId: "question_initial",
    threadStatus: "published",
    threadFollowUpPermissionOverride: null,
    ...overrides,
  });
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function createUniqueConstraintError(constraint: string) {
  return Object.assign(new Error(`duplicate key violates ${constraint}`), {
    code: "23505",
    constraint,
  });
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
