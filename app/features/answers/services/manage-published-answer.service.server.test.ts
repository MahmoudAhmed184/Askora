import { describe, expect, it } from "vitest";

import {
  handlePublishedAnswerAction,
  type ManagedPublishedAnswer,
  type PublishedAnswerManagementStore,
  type PublishedAnswerMutationParams
} from "~/features/answers/services/manage-published-answer.service.server";;
import type { PublishedAnswerActionIntent } from "~/features/answers/validations/answer.validations";
import type {
  CompletedProfileSessionSummary
} from "~/features/auth/services/auth.service.server";;

const now = new Date("2026-05-31T12:00:00.000Z");
const publishedAt = new Date("2026-05-30T12:00:00.000Z");

describe("published answer management", () => {
  it("requires answer text for edit but not for non-edit actions", async () => {
    const invalidEdit = createPublishedAnswerStore();

    await expect(
      submitPublishedAnswerAction({
        formData: createPublishedAnswerActionFormData({
          intent: "edit",
          answerText: "   ",
        }),
        store: invalidEdit.store,
      }),
    ).resolves.toMatchObject({
      status: "invalid",
      fieldErrors: {
        answerText: "Write an answer.",
      },
    });
    expect(invalidEdit.answer.answerText).toBe("Published answer");

    const unpublish = createPublishedAnswerStore();

    await expect(
      submitPublishedAnswerAction({
        formData: createPublishedAnswerActionFormData({ intent: "unpublish" }),
        store: unpublish.store,
      }),
    ).resolves.toMatchObject({
      status: "unpublished",
    });
  });

  it("edits answer text silently while preserving the original publish time", async () => {
    const answers = createPublishedAnswerStore();

    const result = await submitPublishedAnswerAction({
      formData: createPublishedAnswerActionFormData({
        intent: "edit",
        answerText: "  Updated answer\nwith detail  ",
      }),
      store: answers.store,
    });

    expect(result).toMatchObject({
      status: "edited",
      redirectTo: "/person#published-answers",
    });
    expect(answers.answer).toMatchObject({
      answerText: "Updated answer\nwith detail",
      publishedAt,
      updatedAt: now,
    });
    expect(answers.notifications).toEqual([]);
  });

  it("pins at unique positions, ignores duplicates, and denies a fourth pin", async () => {
    const answerOne = createManagedAnswer({
      id: "item_1",
      publicId: "titem_1",
      questionId: "question_1",
      initialQuestionId: "question_1",
    });
    const answerTwo = createManagedAnswer({
      id: "item_2",
      publicId: "titem_2",
      questionId: "question_2",
      initialQuestionId: "question_2",
      threadId: "thread_2",
    });
    const answerThree = createManagedAnswer({
      id: "item_3",
      publicId: "titem_3",
      questionId: "question_3",
      initialQuestionId: "question_3",
      threadId: "thread_3",
    });
    const answerFour = createManagedAnswer({
      id: "item_4",
      publicId: "titem_4",
      questionId: "question_4",
      initialQuestionId: "question_4",
      threadId: "thread_4",
    });
    const answers = createPublishedAnswerStore({
      answers: [answerOne, answerTwo, answerThree, answerFour],
    });

    await submitPublishedAnswerAction({
      formData: createPublishedAnswerActionFormData({ intent: "pin" }),
      store: answers.store,
      threadItemPublicId: "titem_1",
    });
    await submitPublishedAnswerAction({
      formData: createPublishedAnswerActionFormData({ intent: "pin" }),
      store: answers.store,
      threadItemPublicId: "titem_1",
    });
    await submitPublishedAnswerAction({
      formData: createPublishedAnswerActionFormData({ intent: "pin" }),
      store: answers.store,
      threadItemPublicId: "titem_2",
    });
    await submitPublishedAnswerAction({
      formData: createPublishedAnswerActionFormData({ intent: "pin" }),
      store: answers.store,
      threadItemPublicId: "titem_3",
    });
    const fourthPin = await submitPublishedAnswerAction({
      formData: createPublishedAnswerActionFormData({ intent: "pin" }),
      store: answers.store,
      threadItemPublicId: "titem_4",
    });

    expect(answers.pins).toEqual([
      { profileId: "profile_1", threadItemId: "item_1", position: 1 },
      { profileId: "profile_1", threadItemId: "item_2", position: 2 },
      { profileId: "profile_1", threadItemId: "item_3", position: 3 },
    ]);
    expect(fourthPin).toMatchObject({
      status: "denied",
      reason: "pin_limit",
    });
  });

  it("unpublishes the answer, removes its pin, and unpublishes the initial-item thread", async () => {
    const answers = createPublishedAnswerStore({
      pins: [{ profileId: "profile_1", threadItemId: "item_1", position: 1 }],
    });

    const result = await submitPublishedAnswerAction({
      formData: createPublishedAnswerActionFormData({ intent: "unpublish" }),
      store: answers.store,
    });

    expect(result).toMatchObject({ status: "unpublished" });
    expect(answers.answer).toMatchObject({
      answerText: "Published answer",
      itemStatus: "unpublished",
      publishedAt,
    });
    expect(answers.pins).toEqual([]);
    expect(answers.thread.status).toBe("unpublished");
  });

  it("deletes with owner metadata, removes its pin, and deletes the initial-item thread", async () => {
    const answers = createPublishedAnswerStore({
      pins: [{ profileId: "profile_1", threadItemId: "item_1", position: 1 }],
    });

    const result = await submitPublishedAnswerAction({
      formData: createPublishedAnswerActionFormData({ intent: "delete" }),
      store: answers.store,
    });

    expect(result).toMatchObject({ status: "deleted" });
    expect(answers.answer).toMatchObject({
      itemStatus: "deleted",
      deletedAt: now,
      deletedBy: "owner",
    });
    expect(answers.pins).toEqual([]);
    expect(answers.thread.status).toBe("deleted");
  });

  it("denies non-owner and suspended attempts without mutation", async () => {
    const nonOwner = createPublishedAnswerStore();

    await expect(
      submitPublishedAnswerAction({
        formData: createPublishedAnswerActionFormData({
          intent: "edit",
          answerText: "Should not save",
        }),
        session: {
          ...completedSession,
          profile: { ...completedSession.profile, id: "profile_other" },
        },
        store: nonOwner.store,
      }),
    ).resolves.toMatchObject({
      status: "denied",
      reason: "not_found",
    });
    expect(nonOwner.answer.answerText).toBe("Published answer");

    const suspended = createPublishedAnswerStore();

    await expect(
      submitPublishedAnswerAction({
        formData: createPublishedAnswerActionFormData({
          intent: "delete",
        }),
        session: {
          ...completedSession,
          suspensionStatus: "active",
        },
        store: suspended.store,
      }),
    ).resolves.toMatchObject({
      status: "denied",
      reason: "suspended",
    });
    expect(suspended.answer.itemStatus).toBe("published");
  });
});

async function submitPublishedAnswerAction({
  formData,
  session = completedSession,
  store,
  threadItemPublicId = "titem_1",
}: {
  formData: FormData;
  session?: CompletedProfileSessionSummary;
  store: PublishedAnswerManagementStore;
  threadItemPublicId?: string;
}) {
  return handlePublishedAnswerAction({
    formData,
    now,
    session,
    store,
    threadItemPublicId,
  });
}

function createPublishedAnswerActionFormData({
  answerText = "",
  intent,
}: {
  answerText?: string;
  intent: PublishedAnswerActionIntent;
}) {
  const formData = new FormData();

  formData.set("intent", intent);

  if (answerText.length > 0) {
    formData.set("answerText", answerText);
  }

  return formData;
}

interface TestManagedAnswer extends ManagedPublishedAnswer {
  answerText: string;
  updatedAt: Date;
  deletedBy: "owner" | "admin" | null;
}

interface TestThread {
  id: string;
  status: "draft" | "published" | "unpublished" | "deleted";
}

interface TestPinnedAnswer {
  profileId: string;
  threadItemId: string;
  position: number;
}

function createPublishedAnswerStore({
  answers = [createManagedAnswer()],
  pins = [],
}: {
  answers?: TestManagedAnswer[];
  pins?: TestPinnedAnswer[];
} = {}) {
  const threads = new Map<string, TestThread>(
    answers.map((answer) => [
      answer.threadId,
      { id: answer.threadId, status: answer.threadStatus },
    ]),
  );
  const notifications: unknown[] = [];

  const store: PublishedAnswerManagementStore = {
    findPublishedAnswerForManagement(publicId) {
      return Promise.resolve(
        answers.find((answer) => answer.publicId === publicId),
      );
    },
    editPublishedAnswer(params) {
      const answer = findAnswer(answers, params.answer.id);

      if (params.form.intent === "edit") {
        answer.answerText = params.form.answerText;
        answer.updatedAt = params.now;
      }

      return Promise.resolve();
    },
    unpublishPublishedAnswer(params) {
      const answer = findAnswer(answers, params.answer.id);

      removePin(pins, params.answer.id);
      answer.itemStatus = "unpublished";
      answer.updatedAt = params.now;
      markInitialThread(threads, params, "unpublished");

      return Promise.resolve();
    },
    deletePublishedAnswer(params) {
      const answer = findAnswer(answers, params.answer.id);

      removePin(pins, params.answer.id);
      answer.itemStatus = "deleted";
      answer.deletedAt = params.now;
      answer.deletedBy = "owner";
      answer.updatedAt = params.now;
      markInitialThread(threads, params, "deleted");

      return Promise.resolve();
    },
    pinPublishedAnswer(params) {
      if (
        pins.some(
          (pin) =>
            pin.profileId === params.answer.ownerProfileId &&
            pin.threadItemId === params.answer.id,
        )
      ) {
        return Promise.resolve({ status: "pinned" });
      }

      const position = [1, 2, 3].find(
        (candidate) =>
          !pins.some(
            (pin) =>
              pin.profileId === params.answer.ownerProfileId &&
              pin.position === candidate,
          ),
      );

      if (position === undefined) {
        return Promise.resolve({ status: "limit_reached" });
      }

      pins.push({
        profileId: params.answer.ownerProfileId,
        threadItemId: params.answer.id,
        position,
      });

      return Promise.resolve({ status: "pinned" });
    },
    unpinPublishedAnswer(params) {
      removePin(pins, params.answer.id);

      return Promise.resolve();
    },
  };

  return {
    get answer() {
      return firstAnswer(answers);
    },
    notifications,
    pins,
    store,
    get thread() {
      const thread = threads.get(firstAnswer(answers).threadId);

      if (thread === undefined) {
        throw new Error("test thread missing");
      }

      return thread;
    },
  };
}

function firstAnswer(answers: TestManagedAnswer[]) {
  const answer = answers[0];

  if (answer === undefined) {
    throw new Error("test answer missing");
  }

  return answer;
}

function findAnswer(answers: TestManagedAnswer[], id: string) {
  const answer = answers.find((candidate) => candidate.id === id);

  if (answer === undefined) {
    throw new Error(`test answer missing: ${id}`);
  }

  return answer;
}

function removePin(pins: TestPinnedAnswer[], threadItemId: string) {
  const pinIndex = pins.findIndex((pin) => pin.threadItemId === threadItemId);

  if (pinIndex >= 0) {
    pins.splice(pinIndex, 1);
  }
}

function markInitialThread(
  threads: Map<string, TestThread>,
  params: PublishedAnswerMutationParams,
  status: TestThread["status"],
) {
  if (params.answer.questionId !== params.answer.initialQuestionId) {
    return;
  }

  const thread = threads.get(params.answer.threadId);

  if (thread !== undefined) {
    thread.status = status;
  }
}

function createManagedAnswer(
  overrides: Partial<TestManagedAnswer> = {},
): TestManagedAnswer {
  return {
    id: "item_1",
    publicId: "titem_1",
    threadId: "thread_1",
    questionId: "question_1",
    ownerProfileId: "profile_1",
    ownerUserId: "user_1",
    initialQuestionId: "question_1",
    itemStatus: "published",
    threadStatus: "published",
    publishedAt,
    deletedAt: null,
    answerText: "Published answer",
    updatedAt: publishedAt,
    deletedBy: null,
    ...overrides,
  };
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
