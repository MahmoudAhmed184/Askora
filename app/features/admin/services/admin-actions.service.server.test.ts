import { describe, expect, it } from "vitest";

import {
  handleAdminReportAction,
  isSuspensionChangeAllowed,
  type AdminActionMutationParams,
  type AdminReportActionStore
} from "~/features/admin/services/admin-actions.service.server";;
import type { AdminSession } from "~/features/admin/services/admin-auth.service.server";
import {
  getAdminActionTargetReferences,
  type StoredQuestionAdminTarget,
  type StoredAdminReport,
  type StoredProfileAdminTarget,
  type StoredThreadItemAdminTarget
} from "~/features/admin/queries/admin.queries.server";;

const now = new Date("2026-05-31T12:00:00.000Z");

describe("handleAdminReportAction", () => {
  it("rejects actions on terminal reports", async () => {
    const admin = createAdminActionStore({
      report: createStoredReport({
        report: {
          ...createStoredReport().report,
          status: "actioned",
        },
      }),
    });

    await expect(
      submitAdminAction({ actionType: "dismiss", store: admin.store }),
    ).resolves.toMatchObject({
      status: "denied",
      reason: "unavailable",
    });
    expect(admin.applied).toEqual([]);
  });

  it("allows only one concurrent action to claim an open report", async () => {
    let claimed = false;
    let applyCount = 0;
    const store: AdminReportActionStore = {
      findReportById: () => Promise.resolve(createStoredReport()),
      applyAdminAction: () => {
        if (claimed) {
          return Promise.resolve(false);
        }

        claimed = true;
        applyCount += 1;
        return Promise.resolve(true);
      },
    };

    const results = await Promise.all([
      submitAdminAction({ actionType: "dismiss", store }),
      submitAdminAction({ actionType: "dismiss", store }),
    ]);

    expect(results.filter((result) => result.status === "dismissed")).toHaveLength(1);
    expect(results.filter((result) => result.status === "denied")).toHaveLength(1);
    expect(applyCount).toBe(1);
  });

  it("does not allow warnings or shorter suspensions to downgrade active enforcement", () => {
    expect(isSuspensionChangeAllowed("suspended", "warned")).toBe(false);
    expect(isSuspensionChangeAllowed("permanent", "suspended")).toBe(false);
    expect(isSuspensionChangeAllowed("warned", "suspended")).toBe(true);
    expect(isSuspensionChangeAllowed("suspended", "permanent")).toBe(true);
  });

  it("requires notes for suspensions and public content removal", async () => {
    const suspensionStore = createAdminActionStore({
      report: createStoredReport(),
    });

    await expect(
      submitAdminAction({
        actionType: "suspend_7_days",
        store: suspensionStore.store,
      }),
    ).resolves.toMatchObject({
      status: "invalid",
      fieldErrors: {
        notes: "Notes are required for this action.",
      },
    });
    expect(suspensionStore.applied).toEqual([]);

    const removalStore = createAdminActionStore({
      report: createThreadItemReport(),
    });

    await expect(
      submitAdminAction({
        actionType: "remove_public_content",
        store: removalStore.store,
      }),
    ).resolves.toMatchObject({
      status: "invalid",
      fieldErrors: {
        notes: "Notes are required for this action.",
      },
    });
    expect(removalStore.applied).toEqual([]);
  });

  it("dismisses reports with optional notes and logs the admin action", async () => {
    const admin = createAdminActionStore({
      report: createStoredReport({ target: undefined }),
    });

    const result = await submitAdminAction({
      actionType: "dismiss",
      store: admin.store,
    });

    expect(result).toEqual({
      status: "dismissed",
      actionType: "dismiss",
      reportId: "report_1",
    });
    expect(admin.report.report.status).toBe("dismissed");
    expect(admin.adminActions).toEqual([
      expect.objectContaining({
        id: "admin_action_1",
        actionType: "dismiss",
        reportId: "report_1",
        targetUserId: null,
      }),
    ]);
  });

  it("suspends the target user and logs the admin action in one operation", async () => {
    const admin = createAdminActionStore({
      report: createStoredReport(),
    });

    const result = await submitAdminAction({
      actionType: "suspend_7_days",
      notes: "Repeated harassment after warning.",
      store: admin.store,
    });

    expect(result).toEqual({
      status: "actioned",
      actionType: "suspend_7_days",
      reportId: "report_1",
    });
    expect(admin.users.get("asker_user_1")).toEqual({
      suspensionStatus: "suspended",
      suspendedUntil: new Date("2026-06-07T12:00:00.000Z"),
    });
    expect(admin.report.report.status).toBe("actioned");
    expect(admin.adminActions).toEqual([
      expect.objectContaining({
        id: "admin_action_1",
        actionType: "suspend_7_days",
        notes: "Repeated harassment after warning.",
        reportId: "report_1",
        targetUserId: "asker_user_1",
      }),
    ]);
    expect(admin.applied).toHaveLength(1);
  });

  it("does not mutate or log unavailable guest targets", async () => {
    const admin = createAdminActionStore({
      report: createStoredReport({
        target: {
          ...createQuestionTarget(),
          askerUserId: null,
          askerProfileId: null,
        },
      }),
    });

    const result = await submitAdminAction({
      actionType: "warn",
      store: admin.store,
    });

    expect(result).toMatchObject({
      status: "denied",
      reason: "unavailable",
    });
    expect(admin.applied).toEqual([]);
    expect(admin.adminActions).toEqual([]);
    expect(admin.users.size).toBe(0);
    expect(admin.report.report.status).toBe("open");
  });

  it("removes visible initial public content and marks the thread deleted", async () => {
    const admin = createAdminActionStore({
      report: createThreadItemReport(),
    });

    await submitAdminAction({
      actionType: "remove_public_content",
      notes: "Published private information.",
      store: admin.store,
    });

    expect(admin.threadItems.get("thread_item_1")).toMatchObject({
      status: "deleted",
      deletedAt: now,
      deletedBy: "admin",
    });
    expect(admin.threads.get("thread_1")).toMatchObject({
      status: "deleted",
    });
    expect(admin.adminActions).toEqual([
      expect.objectContaining({
        actionType: "remove_public_content",
        targetThreadItemId: "thread_item_1",
      }),
    ]);
  });

  it("hides profiles with an admin deactivation reason", async () => {
    const admin = createAdminActionStore({
      report: createProfileReport(),
    });

    await submitAdminAction({
      actionType: "hide_profile",
      store: admin.store,
    });

    expect(admin.profiles.get("profile_1")).toMatchObject({
      isActive: false,
      deactivatedAt: now,
      deactivationReason: "admin",
    });
  });
});

async function submitAdminAction({
  actionType,
  notes,
  store,
}: {
  actionType: string;
  notes?: string;
  store: AdminReportActionStore;
}) {
  const formData = new FormData();

  formData.set("actionType", actionType);

  if (notes !== undefined) {
    formData.set("notes", notes);
  }

  return handleAdminReportAction({
    createId: () => "admin_action_1",
    formData,
    now,
    reportId: "report_1",
    session: adminSession,
    store,
  });
}

function createAdminActionStore({ report }: { report: StoredAdminReport }) {
  const applied: AdminActionMutationParams[] = [];
  const adminActions: {
    id: string;
    reportId: string;
    actionType: string;
    notes: string | null;
    targetUserId: string | null;
    targetProfileId: string | null;
    targetQuestionId: string | null;
    targetThreadItemId: string | null;
  }[] = [];
  const users = new Map<
    string,
    {
      suspensionStatus: "warned" | "suspended" | "permanent";
      suspendedUntil: Date | null;
    }
  >();
  const threadItems = new Map<string, Partial<StoredThreadItemAdminTarget>>();
  const threads = new Map<string, { status: string }>();
  const profiles = new Map<
    string,
    Partial<StoredProfileAdminTarget> & {
      deactivatedAt?: Date;
      deactivationReason?: "admin";
    }
  >();

  if (report.target?.type === "thread_item") {
    threadItems.set(report.target.id, { ...report.target });
    threads.set(report.target.threadId, { status: report.target.threadStatus });
  }

  if (report.target?.type === "profile") {
    profiles.set(report.target.id, { ...report.target });
  }

  const store: AdminReportActionStore = {
    findReportById(reportId) {
      return Promise.resolve(report.report.id === reportId ? report : undefined);
    },
    applyAdminAction(params) {
      applied.push(params);
      const references = getAdminActionTargetReferences(params.report);

      if (
        params.form.actionType === "warn" &&
        references.targetUserId !== null
      ) {
        users.set(references.targetUserId, {
          suspensionStatus: "warned",
          suspendedUntil: null,
        });
      }

      if (
        params.form.actionType === "suspend_7_days" &&
        references.targetUserId !== null
      ) {
        users.set(references.targetUserId, {
          suspensionStatus: "suspended",
          suspendedUntil: new Date("2026-06-07T12:00:00.000Z"),
        });
      }

      if (
        params.form.actionType === "remove_public_content" &&
        params.report.target?.type === "thread_item"
      ) {
        threadItems.set(params.report.target.id, {
          ...params.report.target,
          status: "deleted",
          deletedAt: params.now,
          deletedBy: "admin",
        });

        if (
          params.report.target.questionId ===
          params.report.target.initialQuestionId
        ) {
          threads.set(params.report.target.threadId, { status: "deleted" });
        }
      }

      if (
        params.form.actionType === "hide_profile" &&
        references.targetProfileId !== null
      ) {
        profiles.set(references.targetProfileId, {
          ...profiles.get(references.targetProfileId),
          isActive: false,
          deactivatedAt: params.now,
          deactivationReason: "admin",
        });
      }

      report.report.status =
        params.form.actionType === "dismiss" ? "dismissed" : "actioned";
      report.report.reviewedAt = params.now;
      report.report.updatedAt = params.now;
      adminActions.push({
        id: params.id,
        reportId: params.report.report.id,
        actionType: params.form.actionType,
        notes: params.form.notes ?? null,
        ...references,
      });

      return Promise.resolve(true);
    },
  };

  return {
    adminActions,
    applied,
    profiles,
    report,
    store,
    threadItems,
    threads,
    users,
  };
}

function createStoredReport(
  overrides: Partial<StoredAdminReport> = {},
): StoredAdminReport {
  return {
    report: {
      id: "report_1",
      targetType: "question",
      targetId: "question_1",
      reason: "harassment",
      details: null,
      status: "open",
      reviewedAt: null,
      createdAt: now,
      updatedAt: now,
    },
    target: createQuestionTarget(),
    ...overrides,
  };
}

function createQuestionTarget(): StoredQuestionAdminTarget {
  return {
    type: "question",
    id: "question_1",
    publicId: "qst_1",
    status: "inbox",
    originalText: "What should I read next?",
    identityMode: "account_anonymous",
    askerUserId: "asker_user_1",
    askerProfileId: "asker_profile_1",
    askerProfile: null,
    recipientProfile: {
      id: "recipient_profile_1",
      userId: "recipient_user_1",
      username: "person",
      displayName: "Person",
      isActive: true,
    },
    deletedAt: null,
    safetyFingerprintHash: "fingerprint_hash_1",
    ipHash: "ip_hash_1",
    normalizedTextHash: "text_hash_1",
    createdAt: now,
  };
}

function createThreadItemReport(): StoredAdminReport {
  return {
    report: {
      id: "report_1",
      targetType: "thread_item",
      targetId: "thread_item_1",
      reason: "private_information",
      details: null,
      status: "open",
      reviewedAt: null,
      createdAt: now,
      updatedAt: now,
    },
    target: {
      type: "thread_item",
      id: "thread_item_1",
      publicId: "titem_1",
      threadId: "thread_1",
      threadPublicId: "thr_1",
      questionId: "question_1",
      initialQuestionId: "question_1",
      answerText: "Published answer",
      displayQuestionText: "Question text",
      questionTextMode: "original",
      status: "published",
      threadStatus: "published",
      deletedAt: null,
      deletedBy: null,
      publishedAt: now,
      ownerProfile: {
        id: "owner_profile_1",
        userId: "owner_user_1",
        username: "person",
        displayName: "Person",
        isActive: true,
      },
      createdAt: now,
    },
  };
}

function createProfileReport(): StoredAdminReport {
  return {
    report: {
      id: "report_1",
      targetType: "profile",
      targetId: "profile_1",
      reason: "harassment",
      details: null,
      status: "open",
      reviewedAt: null,
      createdAt: now,
      updatedAt: now,
    },
    target: {
      type: "profile",
      id: "profile_1",
      userId: "user_1",
      username: "person",
      displayName: "Person",
      bio: "Hello",
      isActive: true,
      userDeletedAt: null,
      createdAt: now,
    },
  };
}

const adminSession = {
  status: "authenticated",
  profileStatus: "incomplete",
  suspensionStatus: "none",
  role: "admin",
  user: {
    id: "admin_user_1",
    email: "admin@example.com",
    name: "Admin",
    image: undefined,
  },
} satisfies AdminSession;
