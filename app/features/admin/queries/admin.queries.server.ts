import { and, count, desc, eq, lt, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { getRuntimeDatabase, type RuntimeDatabase } from "~/db/client.server";
import {
  adminActions,
  authUsers,
  profiles,
  questions,
  reports,
  threadItems,
  threads,
} from "~/db/schema";
import type {
  moderationReportReasonValues,
  moderationReportStatusValues,
  moderationReportTargetTypeValues,
} from "~/db/schema/moderation-values";
import {
  adminActionValues,
  type AdminActionType,
  type AdminQueueStatus,
} from "~/features/admin/validations/admin.validations";
import {
  encodeAdminReportCursor,
  type AdminReportCursor,
} from "~/features/admin/validations/admin-pagination.server";

export type AdminReportTargetType =
  (typeof moderationReportTargetTypeValues)[number];
export type AdminReportReason = (typeof moderationReportReasonValues)[number];
export type AdminReportStatus = (typeof moderationReportStatusValues)[number];

export interface StoredAdminReportRecord {
  id: string;
  targetType: AdminReportTargetType;
  targetId: string;
  reason: AdminReportReason;
  details: string | null;
  status: AdminReportStatus;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type StoredAdminTarget =
  | StoredQuestionAdminTarget
  | StoredThreadItemAdminTarget
  | StoredProfileAdminTarget;

export interface StoredPublicProfileSummary {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  isActive: boolean;
}

export interface StoredQuestionAdminTarget {
  type: "question";
  id: string;
  publicId: string;
  status: "inbox" | "filtered" | "draft" | "answered";
  originalText: string;
  identityMode: "guest_anonymous" | "account_anonymous" | "account_attributed";
  askerUserId: string | null;
  askerProfileId: string | null;
  askerProfile: StoredPublicProfileSummary | null;
  recipientProfile: StoredPublicProfileSummary;
  deletedAt: Date | null;
  safetyFingerprintHash: string;
  ipHash: string | null;
  normalizedTextHash: string;
  createdAt: Date;
}

export interface StoredThreadItemAdminTarget {
  type: "thread_item";
  id: string;
  publicId: string;
  threadId: string;
  threadPublicId: string;
  questionId: string;
  initialQuestionId: string;
  answerText: string;
  displayQuestionText: string | null;
  questionTextMode: "original" | "edited" | "hidden";
  status: "draft" | "published" | "unpublished" | "deleted";
  threadStatus: "draft" | "published" | "unpublished" | "deleted";
  deletedAt: Date | null;
  deletedBy: "owner" | "admin" | null;
  publishedAt: Date | null;
  ownerProfile: StoredPublicProfileSummary;
  createdAt: Date;
}

export interface StoredProfileAdminTarget {
  type: "profile";
  id: string;
  userId: string;
  username: string;
  displayName: string;
  bio: string | null;
  isActive: boolean;
  userDeletedAt: Date | null;
  createdAt: Date;
}

export interface StoredAdminReport {
  report: StoredAdminReportRecord;
  target: StoredAdminTarget | undefined;
}

export interface StoredRelatedReport {
  id: string;
  reason: AdminReportReason;
  status: AdminReportStatus;
  createdAt: Date;
}

export interface StoredRelatedAdminAction {
  id: string;
  reportId: string;
  actionType: AdminActionType;
  notes: string | null;
  createdAt: Date;
}

export interface StoredQuestionSafetyCounts {
  sameSafetyFingerprintQuestionCount: number;
  sameIpQuestionCount: number;
  sameNormalizedTextQuestionCount: number;
}

export interface StoredReportRelatedActivity {
  reports: StoredRelatedReport[];
  adminActions: StoredRelatedAdminAction[];
  questionSafetyCounts: StoredQuestionSafetyCounts | undefined;
}

export interface AdminReportLoaderStore {
  countReportsByStatus(): Promise<Record<AdminQueueStatus, number>>;
  findReportById(reportId: string): Promise<StoredAdminReport | undefined>;
  findReportsByStatus(params: {
    cursor: AdminReportCursor | undefined;
    limit: number;
    status: AdminQueueStatus;
  }): Promise<StoredAdminReport[]>;
  findRelatedActivity(report: StoredAdminReport): Promise<StoredReportRelatedActivity>;
}

export interface AdminReportQueueItemView {
  id: string;
  reason: AdminReportReason;
  status: AdminReportStatus;
  targetType: AdminReportTargetType;
  targetLabel: string;
  targetStatus: string;
  contentPreview: string;
  detailsPreview: string | null;
  metadata: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AdminReportQueueViewData {
  status: AdminQueueStatus;
  counts: Record<AdminQueueStatus, number>;
  reports: AdminReportQueueItemView[];
  nextCursor: string | undefined;
}

export type AdminReportTargetDetailView =
  | {
      type: "question";
      label: string;
      status: string;
      text: string;
      identity: "guest_anonymous" | "account_anonymous" | "account_attributed";
      senderLabel: string;
      recipientProfile: PublicProfileView;
      deletedAt: string | null;
      createdAt: string;
    }
  | {
      type: "thread_item";
      label: string;
      status: string;
      answerText: string;
      questionText: string | null;
      ownerProfile: PublicProfileView;
      publicHref: string;
      deletedAt: string | null;
      deletedBy: "owner" | "admin" | null;
      publishedAt: string | null;
      createdAt: string;
    }
  | {
      type: "profile";
      label: string;
      status: string;
      username: string;
      displayName: string;
      bio: string | null;
      publicHref: string;
      createdAt: string;
    }
  | {
      type: "missing";
      label: string;
      status: "missing";
    };

export interface PublicProfileView {
  username: string;
  displayName: string;
  isActive: boolean;
  publicHref: string;
}

export interface AdminReportDetailViewData {
  report: {
    id: string;
    reason: AdminReportReason;
    status: AdminReportStatus;
    details: string | null;
    targetType: AdminReportTargetType;
    reviewedAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
  target: AdminReportTargetDetailView;
  availableActions: AdminActionType[];
  related: {
    sameTargetReports: {
      id: string;
      reason: AdminReportReason;
      status: AdminReportStatus;
      createdAt: string;
    }[];
    previousAdminActions: {
      id: string;
      reportId: string;
      actionType: AdminActionType;
      notes: string | null;
      createdAt: string;
    }[];
    questionSafetyCounts: StoredQuestionSafetyCounts | null;
  };
}

export type AdminReportDetailLoadResult =
  | {
      status: "found";
      detail: AdminReportDetailViewData;
    }
  | {
      status: "not_found";
    };

const ADMIN_REPORT_PAGE_SIZE = 20;

export async function loadAdminReportQueue({
  cursor,
  status,
  store = createDrizzleAdminReportLoaderStore(),
}: {
  cursor?: AdminReportCursor | undefined;
  status: AdminQueueStatus;
  store?: AdminReportLoaderStore;
}): Promise<AdminReportQueueViewData> {
  const [counts, reportsForStatus] = await Promise.all([
    store.countReportsByStatus(),
    store.findReportsByStatus({
      cursor,
      limit: ADMIN_REPORT_PAGE_SIZE + 1,
      status,
    }),
  ]);
  const pageReports = reportsForStatus.slice(0, ADMIN_REPORT_PAGE_SIZE);
  const lastReport = pageReports.at(-1);

  return {
    status,
    counts,
    reports: pageReports.map(toQueueItemView),
    nextCursor:
      reportsForStatus.length > ADMIN_REPORT_PAGE_SIZE &&
      lastReport !== undefined
        ? encodeAdminReportCursor({
            createdAt: lastReport.report.createdAt,
            id: lastReport.report.id,
          })
        : undefined,
  };
}

export async function loadAdminReportDetail({
  reportId,
  store = createDrizzleAdminReportLoaderStore(),
}: {
  reportId: string;
  store?: AdminReportLoaderStore;
}): Promise<AdminReportDetailLoadResult> {
  const report = await store.findReportById(reportId);

  if (report === undefined) {
    return { status: "not_found" };
  }

  const related = await store.findRelatedActivity(report);

  return {
    status: "found",
    detail: {
      report: {
        id: report.report.id,
        reason: report.report.reason,
        status: report.report.status,
        details: report.report.details,
        targetType: report.report.targetType,
        reviewedAt: report.report.reviewedAt?.toISOString() ?? null,
        createdAt: report.report.createdAt.toISOString(),
        updatedAt: report.report.updatedAt.toISOString(),
      },
      target: toTargetDetailView(report),
      availableActions: getAvailableAdminActions(report),
      related: {
        sameTargetReports: related.reports.map((relatedReport) => ({
          id: relatedReport.id,
          reason: relatedReport.reason,
          status: relatedReport.status,
          createdAt: relatedReport.createdAt.toISOString(),
        })),
        previousAdminActions: related.adminActions.map((action) => ({
          id: action.id,
          reportId: action.reportId,
          actionType: action.actionType,
          notes: action.notes,
          createdAt: action.createdAt.toISOString(),
        })),
        questionSafetyCounts: related.questionSafetyCounts ?? null,
      },
    },
  };
}

export function createDrizzleAdminReportLoaderStore(
  database: RuntimeDatabase = getRuntimeDatabase(),
): AdminReportLoaderStore {
  return {
    async countReportsByStatus() {
      const rows = await database
        .select({
          status: reports.status,
          count: count(),
        })
        .from(reports)
        .groupBy(reports.status);

      const counts = createEmptyStatusCounts();

      for (const row of rows) {
        counts[row.status] = row.count;
      }

      return counts;
    },
    async findReportById(reportId) {
      const [report] = await database
        .select(reportSelect)
        .from(reports)
        .where(eq(reports.id, reportId))
        .limit(1);

      return report === undefined
        ? undefined
        : resolveStoredAdminReport(database, report);
    },
    async findReportsByStatus({ cursor, limit, status }) {
      const cursorWhere =
        cursor === undefined
          ? undefined
          : or(
              lt(reports.createdAt, cursor.createdAt),
              and(
                eq(reports.createdAt, cursor.createdAt),
                lt(reports.id, cursor.id),
              ),
            );
      const reportRows = await database
        .select(reportSelect)
        .from(reports)
        .where(and(eq(reports.status, status), cursorWhere))
        .orderBy(desc(reports.createdAt), desc(reports.id))
        .limit(limit);

      return Promise.all(
        reportRows.map((report) => resolveStoredAdminReport(database, report)),
      );
    },
    async findRelatedActivity(report) {
      const [relatedReports, relatedAdminActions, questionSafetyCounts] =
        await Promise.all([
          findRelatedReports(database, report.report),
          findRelatedAdminActions(database, report.report),
          findQuestionSafetyCounts(database, report.target),
        ]);

      return {
        reports: relatedReports,
        adminActions: relatedAdminActions,
        questionSafetyCounts,
      };
    },
  };
}

export function getAvailableAdminActions(report: StoredAdminReport) {
  return adminActionValues.filter((actionType) =>
    isAdminActionAvailable({ actionType, report }),
  );
}

export function getAdminActionTargetReferences(report: StoredAdminReport): {
  targetUserId: string | null;
  targetProfileId: string | null;
  targetQuestionId: string | null;
  targetThreadItemId: string | null;
} {
  const target = report.target;

  if (target === undefined) {
    return {
      targetUserId: null,
      targetProfileId: null,
      targetQuestionId: null,
      targetThreadItemId: null,
    };
  }

  if (target.type === "question") {
    return {
      targetUserId: target.askerUserId,
      targetProfileId: target.askerProfileId,
      targetQuestionId: target.id,
      targetThreadItemId: null,
    };
  }

  if (target.type === "thread_item") {
    return {
      targetUserId: target.ownerProfile.userId,
      targetProfileId: target.ownerProfile.id,
      targetQuestionId: target.questionId,
      targetThreadItemId: target.id,
    };
  }

  return {
    targetUserId: target.userId,
    targetProfileId: target.id,
    targetQuestionId: null,
    targetThreadItemId: null,
  };
}

function toQueueItemView(report: StoredAdminReport): AdminReportQueueItemView {
  const target = toTargetQueueSummary(report);

  return {
    id: report.report.id,
    reason: report.report.reason,
    status: report.report.status,
    targetType: report.report.targetType,
    targetLabel: target.label,
    targetStatus: target.status,
    contentPreview: target.preview,
    detailsPreview: report.report.details
      ? createPreview(report.report.details, 120)
      : null,
    metadata: target.metadata,
    createdAt: report.report.createdAt.toISOString(),
    updatedAt: report.report.updatedAt.toISOString(),
  };
}

function toTargetQueueSummary(report: StoredAdminReport): {
  label: string;
  status: string;
  preview: string;
  metadata: string[];
} {
  const target = report.target;

  if (target === undefined) {
    return {
      label: "Missing target",
      status: "missing",
      preview: "The reported target no longer exists.",
      metadata: [],
    };
  }

  if (target.type === "question") {
    return {
      label: "Private question",
      status: target.deletedAt === null ? target.status : "deleted",
      preview: createPreview(target.originalText, 150),
      metadata: getQuestionMetadata(target),
    };
  }

  if (target.type === "thread_item") {
    return {
      label: `Public answer by @${target.ownerProfile.username}`,
      status: target.deletedAt === null ? target.status : "deleted",
      preview: createPreview(target.answerText, 150),
      metadata: [
        `thread ${target.threadStatus}`,
        target.deletedBy === null ? "visible state known" : `deleted by ${target.deletedBy}`,
      ],
    };
  }

  return {
    label: `Profile @${target.username}`,
    status: target.isActive ? "active" : "inactive",
    preview: createPreview(target.bio ?? target.displayName, 150),
    metadata: [target.userDeletedAt === null ? "account present" : "account deleted"],
  };
}

function toTargetDetailView(report: StoredAdminReport): AdminReportTargetDetailView {
  const target = report.target;

  if (target === undefined) {
    return {
      type: "missing",
      label: "Missing target",
      status: "missing",
    };
  }

  if (target.type === "question") {
    return {
      type: "question",
      label: "Private question",
      status: target.deletedAt === null ? target.status : "deleted",
      text: target.originalText,
      identity: target.identityMode,
      senderLabel: getQuestionSenderLabel(target),
      recipientProfile: toPublicProfileView(target.recipientProfile),
      deletedAt: target.deletedAt?.toISOString() ?? null,
      createdAt: target.createdAt.toISOString(),
    };
  }

  if (target.type === "thread_item") {
    return {
      type: "thread_item",
      label: "Public answer",
      status: target.deletedAt === null ? target.status : "deleted",
      answerText: target.answerText,
      questionText: getPublicQuestionText(target),
      ownerProfile: toPublicProfileView(target.ownerProfile),
      publicHref: `/${target.ownerProfile.username}/a/${target.threadPublicId}#item-${target.publicId}`,
      deletedAt: target.deletedAt?.toISOString() ?? null,
      deletedBy: target.deletedBy,
      publishedAt: target.publishedAt?.toISOString() ?? null,
      createdAt: target.createdAt.toISOString(),
    };
  }

  return {
    type: "profile",
    label: "Profile",
    status: target.isActive ? "active" : "inactive",
    username: target.username,
    displayName: target.displayName,
    bio: target.bio,
    publicHref: `/${target.username}`,
    createdAt: target.createdAt.toISOString(),
  };
}

function isAdminActionAvailable({
  actionType,
  report,
}: {
  actionType: AdminActionType;
  report: StoredAdminReport;
}) {
  if (report.report.status !== "open") {
    return false;
  }

  if (actionType === "dismiss") {
    return true;
  }

  if (
    actionType === "warn" ||
    actionType === "suspend_7_days" ||
    actionType === "suspend_30_days" ||
    actionType === "permanent_suspension"
  ) {
    return getAdminActionTargetReferences(report).targetUserId !== null;
  }

  if (actionType === "hide_profile") {
    return isHideProfileActionAvailable(report);
  }

  return isRemovePublicContentAvailable(report);
}

function isHideProfileActionAvailable(report: StoredAdminReport) {
  const target = report.target;

  if (target === undefined) {
    return false;
  }

  return target.type === "profile" || target.type === "thread_item";
}

function isRemovePublicContentAvailable(report: StoredAdminReport) {
  const target = report.target;

  return (
    target?.type === "thread_item" &&
    target.status === "published" &&
    target.threadStatus === "published" &&
    target.deletedAt === null
  );
}

function getQuestionMetadata(target: StoredQuestionAdminTarget) {
  return [
    target.askerUserId === null ? "guest sender" : "account-backed sender",
    target.ipHash === null ? "no IP signal" : "IP signal retained",
    target.safetyFingerprintHash.trim().length === 0
      ? "no safety fingerprint"
      : "safety fingerprint retained",
  ];
}

function getQuestionSenderLabel(target: StoredQuestionAdminTarget) {
  if (target.identityMode === "account_attributed" && target.askerProfile !== null) {
    return `@${target.askerProfile.username}`;
  }

  if (target.askerUserId !== null) {
    return "Account-backed anonymous sender";
  }

  return "Guest anonymous sender";
}

function getPublicQuestionText(target: StoredThreadItemAdminTarget) {
  if (target.questionTextMode === "hidden") {
    return null;
  }

  return target.displayQuestionText;
}

function toPublicProfileView(profile: StoredPublicProfileSummary): PublicProfileView {
  return {
    username: profile.username,
    displayName: profile.displayName,
    isActive: profile.isActive,
    publicHref: `/${profile.username}`,
  };
}

function createPreview(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
}

const reportSelect = {
  id: reports.id,
  targetType: reports.targetType,
  targetId: reports.targetId,
  reason: reports.reason,
  details: reports.details,
  status: reports.status,
  reviewedAt: reports.reviewedAt,
  createdAt: reports.createdAt,
  updatedAt: reports.updatedAt,
};

async function resolveStoredAdminReport(
  database: RuntimeDatabase,
  report: StoredAdminReportRecord,
): Promise<StoredAdminReport> {
  return {
    report,
    target: await findStoredTarget(database, report),
  };
}

async function findStoredTarget(
  database: RuntimeDatabase,
  report: StoredAdminReportRecord,
) {
  if (report.targetType === "question") {
    return findQuestionTarget(database, report.targetId);
  }

  if (report.targetType === "thread_item") {
    return findThreadItemTarget(database, report.targetId);
  }

  return findProfileTarget(database, report.targetId);
}

async function findQuestionTarget(
  database: RuntimeDatabase,
  questionId: string,
): Promise<StoredQuestionAdminTarget | undefined> {
  const askerProfiles = alias(profiles, "admin_question_asker_profiles");
  const recipientProfiles = alias(profiles, "admin_question_recipient_profiles");

  const [question] = await database
    .select({
      id: questions.id,
      publicId: questions.publicId,
      status: questions.status,
      originalText: questions.originalText,
      identityMode: questions.identityMode,
      askerUserId: questions.askerUserId,
      askerProfileId: questions.askerProfileId,
      askerProfileUserId: askerProfiles.userId,
      askerProfileUsername: askerProfiles.username,
      askerProfileDisplayName: askerProfiles.displayName,
      askerProfileIsActive: askerProfiles.isActive,
      recipientProfileId: recipientProfiles.id,
      recipientUserId: recipientProfiles.userId,
      recipientProfileUsername: recipientProfiles.username,
      recipientProfileDisplayName: recipientProfiles.displayName,
      recipientProfileIsActive: recipientProfiles.isActive,
      deletedAt: questions.deletedAt,
      safetyFingerprintHash: questions.safetyFingerprintHash,
      ipHash: questions.ipHash,
      normalizedTextHash: questions.normalizedTextHash,
      createdAt: questions.createdAt,
    })
    .from(questions)
    .innerJoin(recipientProfiles, eq(recipientProfiles.id, questions.recipientProfileId))
    .leftJoin(askerProfiles, eq(askerProfiles.id, questions.askerProfileId))
    .where(eq(questions.id, questionId))
    .limit(1);

  if (question === undefined) {
    return undefined;
  }

  return {
    type: "question",
    id: question.id,
    publicId: question.publicId,
    status: question.status,
    originalText: question.originalText,
    identityMode: question.identityMode,
    askerUserId: question.askerUserId,
    askerProfileId: question.askerProfileId,
    askerProfile:
      question.askerProfileId === null ||
      question.askerProfileUserId === null ||
      question.askerProfileUsername === null ||
      question.askerProfileDisplayName === null ||
      question.askerProfileIsActive === null
        ? null
        : {
            id: question.askerProfileId,
            userId: question.askerProfileUserId,
            username: question.askerProfileUsername,
            displayName: question.askerProfileDisplayName,
            isActive: question.askerProfileIsActive,
          },
    recipientProfile: {
      id: question.recipientProfileId,
      userId: question.recipientUserId,
      username: question.recipientProfileUsername,
      displayName: question.recipientProfileDisplayName,
      isActive: question.recipientProfileIsActive,
    },
    deletedAt: question.deletedAt,
    safetyFingerprintHash: question.safetyFingerprintHash,
    ipHash: question.ipHash,
    normalizedTextHash: question.normalizedTextHash,
    createdAt: question.createdAt,
  };
}

async function findThreadItemTarget(
  database: RuntimeDatabase,
  threadItemId: string,
): Promise<StoredThreadItemAdminTarget | undefined> {
  const [item] = await database
    .select({
      id: threadItems.id,
      publicId: threadItems.publicId,
      threadId: threadItems.threadId,
      threadPublicId: threads.publicId,
      questionId: threadItems.questionId,
      initialQuestionId: threads.initialQuestionId,
      answerText: threadItems.answerText,
      displayQuestionText: threadItems.displayQuestionText,
      questionTextMode: threadItems.questionTextMode,
      status: threadItems.status,
      threadStatus: threads.status,
      deletedAt: threadItems.deletedAt,
      deletedBy: threadItems.deletedBy,
      publishedAt: threadItems.publishedAt,
      ownerProfileId: profiles.id,
      ownerUserId: profiles.userId,
      ownerUsername: profiles.username,
      ownerDisplayName: profiles.displayName,
      ownerIsActive: profiles.isActive,
      createdAt: threadItems.createdAt,
    })
    .from(threadItems)
    .innerJoin(threads, eq(threads.id, threadItems.threadId))
    .innerJoin(profiles, eq(profiles.id, threads.ownerProfileId))
    .where(eq(threadItems.id, threadItemId))
    .limit(1);

  if (item === undefined) {
    return undefined;
  }

  return {
    type: "thread_item",
    id: item.id,
    publicId: item.publicId,
    threadId: item.threadId,
    threadPublicId: item.threadPublicId,
    questionId: item.questionId,
    initialQuestionId: item.initialQuestionId,
    answerText: item.answerText,
    displayQuestionText: item.displayQuestionText,
    questionTextMode: item.questionTextMode,
    status: item.status,
    threadStatus: item.threadStatus,
    deletedAt: item.deletedAt,
    deletedBy: item.deletedBy,
    publishedAt: item.publishedAt,
    ownerProfile: {
      id: item.ownerProfileId,
      userId: item.ownerUserId,
      username: item.ownerUsername,
      displayName: item.ownerDisplayName,
      isActive: item.ownerIsActive,
    },
    createdAt: item.createdAt,
  };
}

async function findProfileTarget(
  database: RuntimeDatabase,
  profileId: string,
): Promise<StoredProfileAdminTarget | undefined> {
  const [profile] = await database
    .select({
      id: profiles.id,
      userId: profiles.userId,
      username: profiles.username,
      displayName: profiles.displayName,
      bio: profiles.bio,
      isActive: profiles.isActive,
      userDeletedAt: authUsers.deletedAt,
      createdAt: profiles.createdAt,
    })
    .from(profiles)
    .innerJoin(authUsers, eq(authUsers.id, profiles.userId))
    .where(eq(profiles.id, profileId))
    .limit(1);

  if (profile === undefined) {
    return undefined;
  }

  return {
    type: "profile",
    id: profile.id,
    userId: profile.userId,
    username: profile.username,
    displayName: profile.displayName,
    bio: profile.bio,
    isActive: profile.isActive,
    userDeletedAt: profile.userDeletedAt,
    createdAt: profile.createdAt,
  };
}

async function findRelatedReports(
  database: RuntimeDatabase,
  report: StoredAdminReportRecord,
): Promise<StoredRelatedReport[]> {
  return database
    .select({
      id: reports.id,
      reason: reports.reason,
      status: reports.status,
      createdAt: reports.createdAt,
    })
    .from(reports)
    .where(
      and(
        eq(reports.targetType, report.targetType),
        eq(reports.targetId, report.targetId),
      ),
    )
    .orderBy(desc(reports.createdAt))
    .limit(20);
}

async function findRelatedAdminActions(
  database: RuntimeDatabase,
  report: StoredAdminReportRecord,
): Promise<StoredRelatedAdminAction[]> {
  return database
    .select({
      id: adminActions.id,
      reportId: adminActions.reportId,
      actionType: adminActions.actionType,
      notes: adminActions.notes,
      createdAt: adminActions.createdAt,
    })
    .from(adminActions)
    .where(
      and(
        eq(adminActions.reportTargetType, report.targetType),
        eq(adminActions.reportTargetId, report.targetId),
      ),
    )
    .orderBy(desc(adminActions.createdAt))
    .limit(20);
}

async function findQuestionSafetyCounts(
  database: RuntimeDatabase,
  target: StoredAdminTarget | undefined,
): Promise<StoredQuestionSafetyCounts | undefined> {
  if (target?.type !== "question") {
    return undefined;
  }

  const [
    sameSafetyFingerprintQuestionCount,
    sameIpQuestionCount,
    sameNormalizedTextQuestionCount,
  ] = await Promise.all([
    countQuestionsBy(database, questions.safetyFingerprintHash, target.safetyFingerprintHash),
    target.ipHash === null
      ? Promise.resolve(0)
      : countQuestionsBy(database, questions.ipHash, target.ipHash),
    countQuestionsBy(database, questions.normalizedTextHash, target.normalizedTextHash),
  ]);

  return {
    sameSafetyFingerprintQuestionCount,
    sameIpQuestionCount,
    sameNormalizedTextQuestionCount,
  };
}

async function countQuestionsBy(
  database: RuntimeDatabase,
  column:
    | typeof questions.safetyFingerprintHash
    | typeof questions.ipHash
    | typeof questions.normalizedTextHash,
  value: string,
) {
  const [row] = await database
    .select({
      count: count(),
    })
    .from(questions)
    .where(eq(column, value));

  return row?.count ?? 0;
}

function createEmptyStatusCounts(): Record<AdminQueueStatus, number> {
  return {
    open: 0,
    reviewed: 0,
    actioned: 0,
    dismissed: 0,
  };
}
