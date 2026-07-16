import { describe, expect, it } from "vitest";

import type {
  CompletedProfileSessionSummary
} from "~/features/auth/services/auth.service.server";;
import {
  handleInboxAction,
  type InboxActionQuestion,
  type InboxActionStore,
  type NewQuestionReport,
  type NewSenderBlock
} from "~/features/inbox/services/inbox-actions.service.server";;

const now = new Date("2026-05-31T12:00:00.000Z");

describe("handleInboxAction", () => {
  it("soft-deletes recipient-owned questions with deletedBy recipient", async () => {
    const inbox = createInboxActionStore();

    const result = await submitInboxAction({
      formData: createActionFormData({ intent: "delete" }),
      store: inbox.store,
    });

    expect(result).toEqual({
      status: "deleted",
      questionPublicId: "qst_1",
    });
    expect(inbox.deleted).toEqual([
      {
        questionId: "question_1",
        deletedAt: now,
        deletedBy: "recipient",
      },
    ]);
  });

  it("discards drafted questions without leaving a draft thread item", async () => {
    const inbox = createInboxActionStore({
      draftItemQuestionIds: ["question_1"],
      question: createQuestion({ status: "draft" }),
    });

    await expect(
      submitInboxAction({
        formData: createActionFormData({ intent: "delete" }),
        store: inbox.store,
      }),
    ).resolves.toEqual({
      status: "deleted",
      questionPublicId: "qst_1",
    });
    expect(inbox.deleted).toHaveLength(1);
    expect(inbox.draftItemQuestionIds).toEqual([]);
  });

  it("restores only filtered questions back to inbox", async () => {
    const filteredInbox = createInboxActionStore({
      question: createQuestion({ status: "filtered" }),
    });

    await expect(
      submitInboxAction({
        formData: createActionFormData({ intent: "restore" }),
        store: filteredInbox.store,
      }),
    ).resolves.toEqual({
      status: "restored",
      questionPublicId: "qst_1",
    });
    expect(filteredInbox.restored).toEqual([
      {
        questionId: "question_1",
        updatedAt: now,
      },
    ]);

    const inboxQuestion = createInboxActionStore();

    await expect(
      submitInboxAction({
        formData: createActionFormData({ intent: "restore" }),
        store: inboxQuestion.store,
      }),
    ).resolves.toMatchObject({
      status: "denied",
      reason: "not_filtered",
    });
    expect(inboxQuestion.restored).toEqual([]);
  });

  it("validates report reason and details before writing", async () => {
    const invalidReason = createInboxActionStore();

    await expect(
      submitInboxAction({
        formData: createActionFormData({
          intent: "report",
          reason: "not_a_reason",
        }),
        store: invalidReason.store,
      }),
    ).resolves.toMatchObject({
      status: "invalid",
      fieldErrors: {
        reason: "Choose a report reason.",
      },
    });
    expect(invalidReason.reports).toEqual([]);

    const invalidDetails = createInboxActionStore();

    await expect(
      submitInboxAction({
        formData: createActionFormData({
          intent: "report",
          details: "x".repeat(501),
        }),
        store: invalidDetails.store,
      }),
    ).resolves.toMatchObject({
      status: "invalid",
      fieldErrors: {
        details: "Report details must be 500 characters or fewer.",
      },
    });
    expect(invalidDetails.reports).toEqual([]);
  });

  it("creates report data and extends safety metadata retention", async () => {
    const inbox = createInboxActionStore();

    const result = await submitInboxAction({
      createIds: ["report_1"],
      formData: createActionFormData({
        intent: "report",
        reason: "harassment",
        details: "  Targeted insults  ",
        alsoBlockSender: false,
      }),
      store: inbox.store,
    });

    expect(result).toEqual({
      status: "reported",
      questionPublicId: "qst_1",
    });
    expect(inbox.reports).toEqual([
      {
        id: "report_1",
        reporterUserId: "user_1",
        reporterProfileId: "profile_1",
        targetType: "question",
        targetId: "question_1",
        reason: "harassment",
        details: "Targeted insults",
        status: "open",
        createdAt: now,
        updatedAt: now,
      },
    ]);
    expect(inbox.retentionUpdates).toEqual([
      {
        questionId: "question_1",
        retainUntil: new Date("2026-11-27T12:00:00.000Z"),
        updatedAt: now,
      },
    ]);
  });

  it("reports plus blocks by default, with opt-out support", async () => {
    const defaultBlock = createInboxActionStore({
      question: createQuestion({
        askerUserId: "user_2",
        askerProfileId: "profile_2",
        identityMode: "account_attributed",
      }),
    });

    await expect(
      submitInboxAction({
        createIds: ["report_1", "block_1"],
        formData: createActionFormData({ intent: "report" }),
        store: defaultBlock.store,
      }),
    ).resolves.toEqual({
      status: "reported_and_blocked",
      questionPublicId: "qst_1",
    });
    expect(defaultBlock.reports).toHaveLength(1);
    expect(defaultBlock.blocks).toEqual([
      expect.objectContaining({
        id: "block_1",
        blockedUserId: "user_2",
        blockedProfileId: "profile_2",
        safetyFingerprintHash: "fingerprint_hash_1",
        ipHash: "ip_hash_1",
      }),
    ]);

    const optedOut = createInboxActionStore();

    await submitInboxAction({
      createIds: ["report_1"],
      formData: createActionFormData({
        intent: "report",
        alsoBlockSender: false,
      }),
      store: optedOut.store,
    });

    expect(optedOut.reports).toHaveLength(1);
    expect(optedOut.blocks).toEqual([]);
  });

  it("creates account/profile and anonymous fingerprint blocks idempotently", async () => {
    const accountBlock = createInboxActionStore({
      follows: [
        { followerProfileId: "profile_1", followedProfileId: "profile_2" },
        { followerProfileId: "profile_2", followedProfileId: "profile_1" },
        { followerProfileId: "profile_3", followedProfileId: "profile_1" },
      ],
      question: createQuestion({
        askerUserId: "user_2",
        askerProfileId: "profile_2",
        identityMode: "account_attributed",
      }),
    });

    await submitInboxAction({
      createIds: ["block_1"],
      formData: createActionFormData({ intent: "block" }),
      store: accountBlock.store,
    });

    expect(accountBlock.blocks).toEqual([
      expect.objectContaining({
        blockedUserId: "user_2",
        blockedProfileId: "profile_2",
        safetyFingerprintHash: "fingerprint_hash_1",
        ipHash: "ip_hash_1",
      }),
    ]);
    expect(accountBlock.follows).toEqual([
      { followerProfileId: "profile_3", followedProfileId: "profile_1" },
    ]);

    const anonymousBlock = createInboxActionStore();

    await submitInboxAction({
      createIds: ["block_1"],
      formData: createActionFormData({ intent: "block" }),
      store: anonymousBlock.store,
    });
    await submitInboxAction({
      createIds: ["block_duplicate"],
      formData: createActionFormData({ intent: "block" }),
      store: anonymousBlock.store,
    });

    expect(anonymousBlock.blocks).toEqual([
      expect.objectContaining({
        blockedUserId: null,
        blockedProfileId: null,
        safetyFingerprintHash: "fingerprint_hash_1",
        ipHash: "ip_hash_1",
      }),
    ]);
  });

  it("denies self-blocks and other-owner questions", async () => {
    await expect(
      submitInboxAction({
        formData: createActionFormData({ intent: "block" }),
        store: createInboxActionStore({
          question: createQuestion({ askerUserId: "user_1" }),
        }).store,
      }),
    ).resolves.toMatchObject({
      status: "denied",
      reason: "self_block",
    });

    await expect(
      submitInboxAction({
        formData: createActionFormData({ intent: "delete" }),
        store: createInboxActionStore({
          question: createQuestion({ recipientProfileId: "profile_other" }),
        }).store,
      }),
    ).resolves.toMatchObject({
      status: "denied",
      reason: "not_found",
    });
  });

  it("denies reports for questions owned by another profile", async () => {
    const inbox = createInboxActionStore({
      question: createQuestion({ recipientProfileId: "profile_other" }),
    });

    await expect(
      submitInboxAction({
        formData: createActionFormData({ intent: "report" }),
        store: inbox.store,
      }),
    ).resolves.toMatchObject({
      status: "denied",
      reason: "not_found",
    });
    expect(inbox.reports).toEqual([]);
    expect(inbox.blocks).toEqual([]);
  });

  it("denies anonymous block actions when no safety signal exists", async () => {
    const inbox = createInboxActionStore({
      question: createQuestion({ safetyFingerprintHash: "  " }),
    });

    await expect(
      submitInboxAction({
        formData: createActionFormData({ intent: "block" }),
        store: inbox.store,
      }),
    ).resolves.toMatchObject({
      status: "denied",
      reason: "no_blockable_sender",
    });
    expect(inbox.blocks).toEqual([]);
  });
});

async function submitInboxAction({
  createIds = ["id_1", "id_2", "id_3"],
  formData,
  session = completedSession,
  store,
}: {
  createIds?: string[];
  formData: FormData;
  session?: CompletedProfileSessionSummary;
  store: InboxActionStore;
}) {
  return handleInboxAction({
    createId: () => createIds.shift() ?? "extra_id",
    formData,
    now,
    session,
    store,
  });
}

function createActionFormData({
  alsoBlockSender = true,
  details,
  intent,
  reason = "other",
}: {
  alsoBlockSender?: boolean;
  details?: string;
  intent: "delete" | "restore" | "report" | "block";
  reason?: string;
}) {
  const formData = new FormData();

  formData.set("intent", intent);
  formData.set("questionPublicId", "qst_1");

  if (intent === "report") {
    formData.set("reason", reason);

    if (details !== undefined) {
      formData.set("details", details);
    }

    if (alsoBlockSender) {
      formData.set("alsoBlockSender", "on");
    }
  }

  return formData;
}

function createInboxActionStore({
  draftItemQuestionIds: initialDraftItemQuestionIds = [],
  follows: initialFollows = [],
  question = createQuestion(),
}: {
  draftItemQuestionIds?: string[];
  follows?: {
    followerProfileId: string;
    followedProfileId: string;
  }[];
  question?: InboxActionQuestion;
} = {}) {
  const draftItemQuestionIds = [...initialDraftItemQuestionIds];
  const deleted: Parameters<InboxActionStore["deleteQuestionByRecipient"]>[0][] = [];
  const restored: Parameters<InboxActionStore["restoreFilteredQuestion"]>[0][] = [];
  const reports: NewQuestionReport[] = [];
  const blocks: NewSenderBlock[] = [];
  const retentionUpdates: Parameters<
    InboxActionStore["extendQuestionSafetyMetadataRetention"]
  >[0][] = [];
  const blockKeys = new Set<string>();
  const follows = [...initialFollows];

  const store: InboxActionStore = {
    findQuestionForAction(publicId) {
      return Promise.resolve(question.publicId === publicId ? question : undefined);
    },
    deleteQuestionByRecipient(params) {
      deleted.push(params);
      const itemIndex = draftItemQuestionIds.indexOf(params.questionId);

      if (itemIndex >= 0) {
        draftItemQuestionIds.splice(itemIndex, 1);
      }

      return Promise.resolve();
    },
    restoreFilteredQuestion(params) {
      restored.push(params);
      return Promise.resolve();
    },
    async createReportWithSafetyActions({
      block,
      report,
      retainUntil,
      updatedAt,
    }) {
      reports.push(report);

      if (block !== undefined) {
        await store.createBlock(block);
      }

      retentionUpdates.push({
        questionId: report.targetId,
        retainUntil,
        updatedAt,
      });
    },
    createBlock(block) {
      const key =
        block.blockedUserId === null
          ? `${block.ownerProfileId}:fingerprint:${block.safetyFingerprintHash ?? "none"}`
          : `${block.ownerProfileId}:user:${block.blockedUserId}`;

      if (blockKeys.has(key)) {
        return Promise.resolve("existing");
      }

      blockKeys.add(key);
      blocks.push(block);

      if (block.blockedProfileId !== null) {
        for (let index = follows.length - 1; index >= 0; index -= 1) {
          const follow = follows[index];

          if (
            follow !== undefined &&
            ((follow.followerProfileId === block.ownerProfileId &&
              follow.followedProfileId === block.blockedProfileId) ||
              (follow.followerProfileId === block.blockedProfileId &&
                follow.followedProfileId === block.ownerProfileId))
          ) {
            follows.splice(index, 1);
          }
        }
      }

      return Promise.resolve("created");
    },
    extendQuestionSafetyMetadataRetention(params) {
      retentionUpdates.push(params);
      return Promise.resolve();
    },
  };

  return {
    blocks,
    deleted,
    draftItemQuestionIds,
    follows,
    reports,
    restored,
    retentionUpdates,
    store,
  };
}

function createQuestion(
  overrides: Partial<InboxActionQuestion> = {},
): InboxActionQuestion {
  return {
    id: "question_1",
    publicId: "qst_1",
    recipientProfileId: "profile_1",
    recipientUserId: "user_1",
    askerUserId: null,
    askerProfileId: null,
    identityMode: "guest_anonymous",
    status: "inbox",
    deletedAt: null,
    safetyFingerprintHash: "fingerprint_hash_1",
    ipHash: "ip_hash_1",
    safetyMetadataRetainUntil: new Date("2026-06-30T12:00:00.000Z"),
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
