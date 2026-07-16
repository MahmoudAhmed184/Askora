import { describe, expect, it } from "vitest";

import {
  loadAdminReportDetail,
  loadAdminReportQueue,
  type AdminReportLoaderStore,
  type StoredAdminReport,
  type StoredReportRelatedActivity,
} from "~/features/admin/queries/admin.queries.server";
import { decodeAdminReportCursor } from "~/features/admin/validations/admin-pagination.server";

const now = new Date("2026-05-31T12:00:00.000Z");

describe("admin report loaders", () => {
  it("loads status-filtered queue rows with safe metadata only", async () => {
    const report = createStoredReport();
    const store = createAdminLoaderStore({ reports: [report] });

    const queue = await loadAdminReportQueue({
      status: "open",
      store: store.store,
    });

    expect(queue.reports).toEqual([
      expect.objectContaining({
        id: "report_1",
        targetLabel: "Private question",
        contentPreview: "What should I read next?",
        metadata: [
          "account-backed sender",
          "IP signal retained",
          "safety fingerprint retained",
        ],
      }),
    ]);
    expect(JSON.stringify(queue)).not.toContain("asker_user_sensitive");
    expect(JSON.stringify(queue)).not.toContain("raw_ip_hash_sensitive");
    expect(JSON.stringify(queue)).not.toContain("raw_fingerprint_sensitive");
  });

  it("paginates the report queue with a stable created-at and ID cursor", async () => {
    const reports = Array.from({ length: 21 }, (_, index) =>
      createStoredReportAt(index),
    );
    const store = createAdminLoaderStore({ reports });

    const firstPage = await loadAdminReportQueue({
      status: "open",
      store: store.store,
    });

    expect(firstPage.reports).toHaveLength(20);
    expect(firstPage.reports.at(-1)?.id).toBe("report_19");
    expect(decodeAdminReportCursor(firstPage.nextCursor)).toEqual({
      createdAt: new Date("2026-05-31T11:59:41.000Z"),
      id: "report_19",
    });

    const secondPage = await loadAdminReportQueue({
      cursor: decodeAdminReportCursor(firstPage.nextCursor),
      status: "open",
      store: store.store,
    });

    expect(secondPage.reports.map((report) => report.id)).toEqual([
      "report_20",
    ]);
    expect(secondPage.nextCursor).toBeUndefined();
    expect(secondPage.counts.open).toBe(21);
  });

  it("does not expose anonymous asker IDs or raw safety hashes in detail data", async () => {
    const report = createStoredReport();
    const store = createAdminLoaderStore({ reports: [report] });

    const detail = await loadAdminReportDetail({
      reportId: "report_1",
      store: store.store,
    });

    expect(detail).toMatchObject({
      status: "found",
      detail: {
        target: {
          type: "question",
          senderLabel: "Account-backed anonymous sender",
        },
        related: {
          questionSafetyCounts: {
            sameSafetyFingerprintQuestionCount: 3,
            sameIpQuestionCount: 2,
            sameNormalizedTextQuestionCount: 5,
          },
        },
      },
    });
    const serialized = JSON.stringify(detail);

    expect(serialized).not.toContain("asker_user_sensitive");
    expect(serialized).not.toContain("asker_profile_sensitive");
    expect(serialized).not.toContain("raw_ip_hash_sensitive");
    expect(serialized).not.toContain("raw_fingerprint_sensitive");
  });
});

function createAdminLoaderStore({
  reports,
  related = createRelatedActivity(),
}: {
  reports: StoredAdminReport[];
  related?: StoredReportRelatedActivity;
}) {
  const store: AdminReportLoaderStore = {
    countReportsByStatus() {
      return Promise.resolve({
        open: reports.filter((report) => report.report.status === "open").length,
        reviewed: reports.filter((report) => report.report.status === "reviewed")
          .length,
        actioned: reports.filter((report) => report.report.status === "actioned")
          .length,
        dismissed: reports.filter(
          (report) => report.report.status === "dismissed",
        ).length,
      });
    },
    findReportById(reportId) {
      return Promise.resolve(
        reports.find((report) => report.report.id === reportId),
      );
    },
    findReportsByStatus({ cursor, limit, status }) {
      const page = reports
        .filter((report) => report.report.status === status)
        .sort(
          (left, right) =>
            right.report.createdAt.getTime() - left.report.createdAt.getTime() ||
            right.report.id.localeCompare(left.report.id),
        )
        .filter(
          (report) =>
            cursor === undefined ||
            report.report.createdAt.getTime() < cursor.createdAt.getTime() ||
            (report.report.createdAt.getTime() === cursor.createdAt.getTime() &&
              report.report.id < cursor.id),
        )
        .slice(0, limit);

      return Promise.resolve(
        page,
      );
    },
    findRelatedActivity() {
      return Promise.resolve(related);
    },
  };

  return { store };
}

function createStoredReportAt(index: number) {
  const report = createStoredReport();

  return {
    ...report,
    report: {
      ...report.report,
      id: `report_${String(index)}`,
      createdAt: new Date(now.getTime() - index * 1_000),
    },
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
      details: "The sender keeps targeting me.",
      status: "open",
      reviewedAt: null,
      createdAt: now,
      updatedAt: now,
    },
    target: {
      type: "question",
      id: "question_1",
      publicId: "qst_1",
      status: "inbox",
      originalText: "What should I read next?",
      identityMode: "account_anonymous",
      askerUserId: "asker_user_sensitive",
      askerProfileId: "asker_profile_sensitive",
      askerProfile: null,
      recipientProfile: {
        id: "recipient_profile_1",
        userId: "recipient_user_1",
        username: "person",
        displayName: "Person",
        isActive: true,
      },
      deletedAt: null,
      safetyFingerprintHash: "raw_fingerprint_sensitive",
      ipHash: "raw_ip_hash_sensitive",
      normalizedTextHash: "raw_text_hash_sensitive",
      createdAt: now,
    },
    ...overrides,
  };
}

function createRelatedActivity(): StoredReportRelatedActivity {
  return {
    reports: [
      {
        id: "report_1",
        reason: "harassment",
        status: "open",
        createdAt: now,
      },
    ],
    adminActions: [],
    questionSafetyCounts: {
      sameSafetyFingerprintQuestionCount: 3,
      sameIpQuestionCount: 2,
      sameNormalizedTextQuestionCount: 5,
    },
  };
}
