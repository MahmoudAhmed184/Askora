import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { ZodError } from "zod";

import { getRuntimeDatabase, type RuntimeDatabase } from "~/db/client.server";
import {
  authUsers,
  notifications,
  profiles,
  questions,
  threadItems,
  threads,
} from "~/db/schema";
import type { notificationTypeValues } from "~/db/schema";
import type { CompletedProfileSessionSummary } from "~/features/auth/auth.server";
import { notificationActionSchema } from "~/features/notifications/notification.schema";
import { parseFormData } from "~/lib/zod-form";

const NOTIFICATION_RETENTION_DAYS = 180;
const NOTIFICATION_LIST_LIMIT = 50;
const NOTIFICATIONS_ROUTE = "/dashboard/notifications";

export type NotificationType = (typeof notificationTypeValues)[number];

export interface NotificationInsert {
  id: string;
  recipientUserId: string;
  type: NotificationType;
  actorUserId: string | null;
  threadId: string | null;
  threadItemId: string | null;
  questionId: string | null;
  readAt: Date | null;
  createdAt: Date;
  expiresAt: Date;
}

export type QuestionAnsweredNotification = NotificationInsert & {
  type: "question_answered";
  actorUserId: string;
  threadId: string;
  threadItemId: string;
  questionId: string;
};

export type FollowUpAskedNotification = NotificationInsert & {
  type: "follow_up_asked";
  threadId: string;
  threadItemId: null;
  questionId: string;
};

export type FollowUpAnsweredNotification = NotificationInsert & {
  type: "follow_up_answered";
  actorUserId: string;
  threadId: string;
  threadItemId: string;
  questionId: string;
};

export type AnswerLikedNotification = NotificationInsert & {
  type: "answer_liked";
  actorUserId: string;
  threadId: string;
  threadItemId: string;
  questionId: null;
};

export type ProfileFollowedNotification = NotificationInsert & {
  type: "profile_followed";
  actorUserId: string;
  threadId: null;
  threadItemId: null;
  questionId: null;
};

export interface NotificationActorView {
  displayName: string;
  username: string;
  avatarUrl: string | null;
  href: string;
}

export interface NotificationView {
  id: string;
  type: NotificationType;
  message: string;
  createdAt: string;
  readAt: string | null;
  actor: NotificationActorView | undefined;
  targetHref: string | undefined;
}

export interface NotificationsPageData {
  notifications: NotificationView[];
  unreadCount: number;
}

export interface NotificationRow {
  id: string;
  recipientUserId: string;
  type: NotificationType;
  actorUserId: string | null;
  threadId: string | null;
  threadItemId: string | null;
  questionId: string | null;
  readAt: Date | null;
  createdAt: Date;
  expiresAt: Date;
  actorUsername: string | null;
  actorDisplayName: string | null;
  actorAvatarUrl: string | null;
  actorIsActive: boolean | null;
  actorUserDeletedAt: Date | null;
  ownerUsername: string | null;
  ownerIsActive: boolean | null;
  ownerUserDeletedAt: Date | null;
  threadPublicId: string | null;
  threadStatus: "draft" | "published" | "unpublished" | "deleted" | null;
  threadItemPublicId: string | null;
  threadItemStatus: "draft" | "published" | "unpublished" | "deleted" | null;
  threadItemDeletedAt: Date | null;
  questionPublicId: string | null;
  questionStatus: "inbox" | "filtered" | "draft" | "answered" | null;
  questionDeletedAt: Date | null;
  questionIdentityMode:
    | "guest_anonymous"
    | "account_anonymous"
    | "account_attributed"
    | null;
}

export interface NotificationStore {
  countUnreadNotifications(params: {
    now: Date;
    recipientUserId: string;
  }): Promise<number>;
  findNotificationByIdForRecipient(params: {
    id: string;
    now: Date;
    recipientUserId: string;
  }): Promise<NotificationRow | undefined>;
  findNotificationsForRecipient(params: {
    limit: number;
    now: Date;
    recipientUserId: string;
  }): Promise<NotificationRow[]>;
  markAllNotificationsRead(params: {
    now: Date;
    recipientUserId: string;
  }): Promise<void>;
  markNotificationRead(params: {
    id: string;
    now: Date;
    recipientUserId: string;
  }): Promise<void>;
}

export type NotificationActionResult =
  | {
      status: "marked_read";
      redirectTo: string;
    }
  | {
      status: "marked_all_read";
      redirectTo: string;
    }
  | {
      status: "invalid";
      formError: string;
      fieldErrors: NotificationActionFieldErrors;
    };

export interface NotificationActionFieldErrors {
  intent?: string;
  notificationId?: string;
}

export function createNotificationExpiresAt(now: Date) {
  return addDays(now, NOTIFICATION_RETENTION_DAYS);
}

export function createQuestionAnsweredNotification({
  actorUserId,
  id,
  now,
  questionId,
  recipientUserId,
  threadId,
  threadItemId,
}: {
  id: string;
  recipientUserId: string;
  actorUserId: string;
  threadId: string;
  threadItemId: string;
  questionId: string;
  now: Date;
}): QuestionAnsweredNotification {
  return {
    id,
    recipientUserId,
    type: "question_answered",
    actorUserId,
    threadId,
    threadItemId,
    questionId,
    readAt: null,
    createdAt: now,
    expiresAt: createNotificationExpiresAt(now),
  };
}

export function createQuestionAnsweredNotificationForQuestion({
  actorUserId,
  createId,
  now,
  question,
  threadId,
  threadItemId,
}: {
  question: {
    id: string;
    askerUserId: string | null;
    identityMode?: unknown;
  };
  actorUserId: string;
  threadId: string;
  threadItemId: string;
  createId: () => string;
  now: Date;
}): QuestionAnsweredNotification | undefined {
  if (question.askerUserId === null) {
    return undefined;
  }

  return createQuestionAnsweredNotification({
    id: createId(),
    recipientUserId: question.askerUserId,
    actorUserId,
    threadId,
    threadItemId,
    questionId: question.id,
    now,
  });
}

export function createFollowUpAskedNotification({
  actorUserId,
  id,
  now,
  questionId,
  recipientUserId,
  threadId,
}: {
  id: string;
  recipientUserId: string;
  actorUserId: string | null;
  threadId: string;
  questionId: string;
  now: Date;
}): FollowUpAskedNotification | undefined {
  if (actorUserId === recipientUserId) {
    return undefined;
  }

  return {
    id,
    recipientUserId,
    type: "follow_up_asked",
    actorUserId,
    threadId,
    threadItemId: null,
    questionId,
    readAt: null,
    createdAt: now,
    expiresAt: createNotificationExpiresAt(now),
  };
}

export function createFollowUpAnsweredNotification({
  actorUserId,
  id,
  now,
  questionId,
  recipientUserId,
  threadId,
  threadItemId,
}: {
  id: string;
  recipientUserId: string;
  actorUserId: string;
  threadId: string;
  threadItemId: string;
  questionId: string;
  now: Date;
}): FollowUpAnsweredNotification {
  return {
    id,
    recipientUserId,
    type: "follow_up_answered",
    actorUserId,
    threadId,
    threadItemId,
    questionId,
    readAt: null,
    createdAt: now,
    expiresAt: createNotificationExpiresAt(now),
  };
}

export function createAnswerLikedNotification({
  actorUserId,
  id,
  now,
  recipientUserId,
  threadId,
  threadItemId,
}: {
  id: string;
  recipientUserId: string;
  actorUserId: string;
  threadId: string;
  threadItemId: string;
  now: Date;
}): AnswerLikedNotification {
  return {
    id,
    recipientUserId,
    type: "answer_liked",
    actorUserId,
    threadId,
    threadItemId,
    questionId: null,
    readAt: null,
    createdAt: now,
    expiresAt: createNotificationExpiresAt(now),
  };
}

export function createProfileFollowedNotification({
  actorUserId,
  id,
  now,
  recipientUserId,
}: {
  id: string;
  recipientUserId: string;
  actorUserId: string;
  now: Date;
}): ProfileFollowedNotification {
  return {
    id,
    recipientUserId,
    type: "profile_followed",
    actorUserId,
    threadId: null,
    threadItemId: null,
    questionId: null,
    readAt: null,
    createdAt: now,
    expiresAt: createNotificationExpiresAt(now),
  };
}

export async function loadNotifications({
  now = new Date(),
  session,
  store = createDrizzleNotificationStore(),
}: {
  session: CompletedProfileSessionSummary;
  store?: NotificationStore;
  now?: Date;
}): Promise<NotificationsPageData> {
  const [rows, unreadCount] = await Promise.all([
    store.findNotificationsForRecipient({
      limit: NOTIFICATION_LIST_LIMIT,
      now,
      recipientUserId: session.user.id,
    }),
    store.countUnreadNotifications({
      now,
      recipientUserId: session.user.id,
    }),
  ]);

  return {
    notifications: rows.map(toNotificationView),
    unreadCount,
  };
}

export async function getUnreadNotificationCount({
  now = new Date(),
  recipientUserId,
  store = createDrizzleNotificationStore(),
}: {
  recipientUserId: string;
  store?: NotificationStore;
  now?: Date;
}) {
  return store.countUnreadNotifications({ now, recipientUserId });
}

export async function handleNotificationAction({
  formData,
  now = new Date(),
  session,
  store = createDrizzleNotificationStore(),
}: {
  formData: FormData;
  session: CompletedProfileSessionSummary;
  store?: NotificationStore;
  now?: Date;
}): Promise<NotificationActionResult> {
  const parsed = parseFormData(notificationActionSchema, formData);

  if (!parsed.ok) {
    return invalidResult(parsed.error);
  }

  if (parsed.value.intent === "mark_all_read") {
    await store.markAllNotificationsRead({
      now,
      recipientUserId: session.user.id,
    });

    return {
      status: "marked_all_read",
      redirectTo: NOTIFICATIONS_ROUTE,
    };
  }

  const row = await store.findNotificationByIdForRecipient({
    id: parsed.value.notificationId,
    now,
    recipientUserId: session.user.id,
  });

  if (row === undefined) {
    return {
      status: "marked_read",
      redirectTo: NOTIFICATIONS_ROUTE,
    };
  }

  await store.markNotificationRead({
    id: parsed.value.notificationId,
    now,
    recipientUserId: session.user.id,
  });

  return {
    status: "marked_read",
    redirectTo: toNotificationTargetHref(row) ?? NOTIFICATIONS_ROUTE,
  };
}

export function createDrizzleNotificationStore(
  database: RuntimeDatabase = getRuntimeDatabase(),
): NotificationStore {
  return {
    async countUnreadNotifications({ now, recipientUserId }) {
      const [row] = await database
        .select({ count: sql<number>`count(*)::int` })
        .from(notifications)
        .where(
          and(
            eq(notifications.recipientUserId, recipientUserId),
            isNull(notifications.readAt),
            gt(notifications.expiresAt, now),
          ),
        );

      return row?.count ?? 0;
    },
    async findNotificationByIdForRecipient({ id, now, recipientUserId }) {
      const [row] = await selectNotificationRows(database)
        .where(
          and(
            eq(notifications.id, id),
            eq(notifications.recipientUserId, recipientUserId),
            gt(notifications.expiresAt, now),
          ),
        )
        .limit(1);

      return row;
    },
    async findNotificationsForRecipient({ limit, now, recipientUserId }) {
      return selectNotificationRows(database)
        .where(
          and(
            eq(notifications.recipientUserId, recipientUserId),
            gt(notifications.expiresAt, now),
          ),
        )
        .orderBy(desc(notifications.createdAt))
        .limit(limit);
    },
    async markAllNotificationsRead({ now, recipientUserId }) {
      await database
        .update(notifications)
        .set({ readAt: now })
        .where(
          and(
            eq(notifications.recipientUserId, recipientUserId),
            isNull(notifications.readAt),
            gt(notifications.expiresAt, now),
          ),
        );
    },
    async markNotificationRead({ id, now, recipientUserId }) {
      await database
        .update(notifications)
        .set({ readAt: now })
        .where(
          and(
            eq(notifications.id, id),
            eq(notifications.recipientUserId, recipientUserId),
          ),
        );
    },
  };
}

function selectNotificationRows(database: RuntimeDatabase) {
  const actorProfiles = alias(profiles, "notification_actor_profiles");
  const actorUsers = alias(authUsers, "notification_actor_users");
  const ownerProfiles = alias(profiles, "notification_owner_profiles");
  const ownerUsers = alias(authUsers, "notification_owner_users");

  return database
    .select({
      id: notifications.id,
      recipientUserId: notifications.recipientUserId,
      type: notifications.type,
      actorUserId: notifications.actorUserId,
      threadId: notifications.threadId,
      threadItemId: notifications.threadItemId,
      questionId: notifications.questionId,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
      expiresAt: notifications.expiresAt,
      actorUsername: actorProfiles.username,
      actorDisplayName: actorProfiles.displayName,
      actorAvatarUrl: actorProfiles.avatarUrl,
      actorIsActive: actorProfiles.isActive,
      actorUserDeletedAt: actorUsers.deletedAt,
      ownerUsername: ownerProfiles.username,
      ownerIsActive: ownerProfiles.isActive,
      ownerUserDeletedAt: ownerUsers.deletedAt,
      threadPublicId: threads.publicId,
      threadStatus: threads.status,
      threadItemPublicId: threadItems.publicId,
      threadItemStatus: threadItems.status,
      threadItemDeletedAt: threadItems.deletedAt,
      questionPublicId: questions.publicId,
      questionStatus: questions.status,
      questionDeletedAt: questions.deletedAt,
      questionIdentityMode: questions.identityMode,
    })
    .from(notifications)
    .leftJoin(actorUsers, eq(actorUsers.id, notifications.actorUserId))
    .leftJoin(actorProfiles, eq(actorProfiles.userId, notifications.actorUserId))
    .leftJoin(threadItems, eq(threadItems.id, notifications.threadItemId))
    .leftJoin(threads, eq(threads.id, notifications.threadId))
    .leftJoin(ownerProfiles, eq(ownerProfiles.id, threads.ownerProfileId))
    .leftJoin(ownerUsers, eq(ownerUsers.id, ownerProfiles.userId))
    .leftJoin(questions, eq(questions.id, notifications.questionId));
}

function toNotificationView(row: NotificationRow): NotificationView {
  const actor = toNotificationActor(row);

  return {
    id: row.id,
    type: row.type,
    message: getNotificationMessage(row.type),
    createdAt: row.createdAt.toISOString(),
    readAt: row.readAt?.toISOString() ?? null,
    actor,
    targetHref: toNotificationTargetHref(row, actor),
  };
}

function toNotificationActor(row: NotificationRow) {
  if (
    row.actorUserId === null ||
    row.actorUsername === null ||
    row.actorDisplayName === null ||
    row.actorIsActive !== true ||
    row.actorUserDeletedAt !== null
  ) {
    return undefined;
  }

  if (
    row.type === "follow_up_asked" &&
    row.questionIdentityMode !== "account_attributed"
  ) {
    return undefined;
  }

  return {
    displayName: row.actorDisplayName,
    username: row.actorUsername,
    avatarUrl: row.actorAvatarUrl,
    href: `/${row.actorUsername}`,
  } satisfies NotificationActorView;
}

function toNotificationTargetHref(
  row: NotificationRow,
  actor = toNotificationActor(row),
) {
  switch (row.type) {
    case "question_answered":
    case "follow_up_answered":
    case "answer_liked":
      return getPublishedThreadItemHref(row);
    case "follow_up_asked":
      return getFollowUpAskedHref(row);
    case "profile_followed":
      return actor?.href;
  }
}

function getNotificationMessage(type: NotificationType) {
  switch (type) {
    case "question_answered":
      return "Your question was answered.";
    case "follow_up_asked":
      return "You received a follow-up.";
    case "follow_up_answered":
      return "A follow-up was answered.";
    case "answer_liked":
      return "Your answer got a new like.";
    case "profile_followed":
      return "You have a new follower.";
  }
}

function getPublishedThreadItemHref(row: NotificationRow) {
  if (
    row.ownerUsername === null ||
    row.ownerIsActive !== true ||
    row.ownerUserDeletedAt !== null ||
    row.threadPublicId === null ||
    row.threadStatus !== "published" ||
    row.threadItemPublicId === null ||
    row.threadItemStatus !== "published" ||
    row.threadItemDeletedAt !== null
  ) {
    return undefined;
  }

  return `/${row.ownerUsername}/a/${row.threadPublicId}#item-${row.threadItemPublicId}`;
}

function getFollowUpAskedHref(row: NotificationRow) {
  if (row.questionDeletedAt !== null || row.questionPublicId === null) {
    return undefined;
  }

  if (row.questionStatus === "inbox" || row.questionStatus === "draft") {
    return `/dashboard/answer/${row.questionPublicId}`;
  }

  if (row.questionStatus === "filtered") {
    return "/dashboard/filtered";
  }

  return undefined;
}

function invalidResult(error: ZodError): NotificationActionResult {
  return {
    status: "invalid",
    fieldErrors: getNotificationActionFieldErrors(error),
    formError: "Check the notification action and try again.",
  };
}

function getNotificationActionFieldErrors(
  error: ZodError,
): NotificationActionFieldErrors {
  const fieldErrors: NotificationActionFieldErrors = {};

  for (const issue of error.issues) {
    const field = issue.path[0];

    if (field === "intent" && fieldErrors.intent === undefined) {
      fieldErrors.intent = issue.message;
    }

    if (
      field === "notificationId" &&
      fieldErrors.notificationId === undefined
    ) {
      fieldErrors.notificationId = issue.message;
    }
  }

  return fieldErrors;
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}
