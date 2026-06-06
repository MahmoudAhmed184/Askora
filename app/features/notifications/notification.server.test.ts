import { describe, expect, it } from "vitest";

import type { CompletedProfileSessionSummary } from "~/features/auth/auth.server";
import {
  createNotificationExpiresAt,
  createQuestionAnsweredNotificationForQuestion,
  getUnreadNotificationCount,
  handleNotificationAction,
  loadNotifications,
  type NotificationRow,
  type NotificationStore,
} from "~/features/notifications/notification.server";

const now = new Date("2026-05-31T12:00:00.000Z");

describe("notification helpers", () => {
  it("creates answer notifications for account askers only", () => {
    const baseParams = {
      actorUserId: "owner_user",
      createId: () => "notification_1",
      now,
      threadId: "thread_1",
      threadItemId: "item_1",
    };

    expect(
      createQuestionAnsweredNotificationForQuestion({
        ...baseParams,
        question: {
          id: "question_1",
          askerUserId: "anonymous_account_user",
          identityMode: "account_anonymous",
        },
      }),
    ).toMatchObject({
      recipientUserId: "anonymous_account_user",
      type: "question_answered",
    });
    expect(
      createQuestionAnsweredNotificationForQuestion({
        ...baseParams,
        question: {
          id: "question_2",
          askerUserId: "attributed_account_user",
          identityMode: "account_attributed",
        },
      }),
    ).toMatchObject({
      recipientUserId: "attributed_account_user",
      type: "question_answered",
    });
    expect(
      createQuestionAnsweredNotificationForQuestion({
        ...baseParams,
        question: {
          id: "question_3",
          askerUserId: null,
          identityMode: "guest_anonymous",
        },
      }),
    ).toBeUndefined();
  });

  it("sets notification expiration exactly 180 days from now", () => {
    expect(createNotificationExpiresAt(now)).toEqual(
      new Date("2026-11-27T12:00:00.000Z"),
    );
  });
});

describe("notification loading and actions", () => {
  it("loads recipient notifications only and excludes expired rows from the list", async () => {
    const notifications = createNotificationStore({
      rows: [
        createNotificationRow({ id: "visible" }),
        createNotificationRow({
          id: "other_recipient",
          recipientUserId: "other_user",
        }),
        createNotificationRow({
          id: "expired",
          expiresAt: new Date("2026-05-30T12:00:00.000Z"),
        }),
      ],
    });

    await expect(
      loadNotifications({
        now,
        session: completedSession,
        store: notifications.store,
      }),
    ).resolves.toMatchObject({
      notifications: [
        {
          id: "visible",
          targetHref: "/person/a/thread_public_1#item-item_public_1",
        },
      ],
    });
    await expect(
      getUnreadNotificationCount({
        now,
        recipientUserId: completedSession.user.id,
        store: notifications.store,
      }),
    ).resolves.toBe(1);
  });

  it("renders anonymous follow-up actors generically and links filtered follow-ups to filtered", async () => {
    const notifications = createNotificationStore({
      rows: [
        createNotificationRow({
          id: "anonymous_follow_up",
          type: "follow_up_asked",
          actorUserId: "asker_user",
          actorUsername: "asker",
          actorDisplayName: "Asker",
          actorIsActive: true,
          questionIdentityMode: "account_anonymous",
          questionPublicId: "qst_1",
          questionStatus: "inbox",
          threadItemId: null,
          threadItemPublicId: null,
          threadItemStatus: null,
        }),
        createNotificationRow({
          id: "filtered_follow_up",
          type: "follow_up_asked",
          questionPublicId: "qst_filtered",
          questionStatus: "filtered",
          threadItemId: null,
          threadItemPublicId: null,
          threadItemStatus: null,
        }),
      ],
    });

    const page = await loadNotifications({
      now,
      session: completedSession,
      store: notifications.store,
    });

    expect(page.notifications).toEqual([
      expect.objectContaining({
        id: "anonymous_follow_up",
        actor: undefined,
        message: "You received a follow-up.",
        targetHref: "/dashboard/answer/qst_1",
      }),
      expect.objectContaining({
        id: "filtered_follow_up",
        targetHref: "/dashboard/filtered",
      }),
    ]);
  });

  it("marks one notification read for the current recipient only", async () => {
    const notifications = createNotificationStore({
      rows: [
        createNotificationRow({ id: "mine" }),
        createNotificationRow({ id: "theirs", recipientUserId: "other_user" }),
      ],
    });

    await expect(
      handleNotificationAction({
        formData: createActionFormData({
          intent: "mark_read",
          notificationId: "mine",
        }),
        now,
        session: completedSession,
        store: notifications.store,
      }),
    ).resolves.toEqual({
      status: "marked_read",
      redirectTo: "/person/a/thread_public_1#item-item_public_1",
    });
    await handleNotificationAction({
      formData: createActionFormData({
        intent: "mark_read",
        notificationId: "theirs",
      }),
      now,
      session: completedSession,
      store: notifications.store,
    });

    expect(notifications.rows.find((row) => row.id === "mine")?.readAt).toBe(
      now,
    );
    expect(notifications.rows.find((row) => row.id === "theirs")?.readAt).toBeNull();
  });

  it("can mark one notification read and stay on notifications", async () => {
    const notifications = createNotificationStore({
      rows: [createNotificationRow({ id: "mine" })],
    });

    await expect(
      handleNotificationAction({
        formData: createActionFormData({
          intent: "mark_read",
          notificationId: "mine",
          redirectTo: "notifications",
        }),
        now,
        session: completedSession,
        store: notifications.store,
      }),
    ).resolves.toEqual({
      status: "marked_read",
      redirectTo: "/dashboard/notifications",
    });

    expect(notifications.rows.find((row) => row.id === "mine")?.readAt).toBe(
      now,
    );
  });

  it("marks all current recipient unread unexpired notifications read", async () => {
    const notifications = createNotificationStore({
      rows: [
        createNotificationRow({ id: "mine_unread" }),
        createNotificationRow({
          id: "mine_read",
          readAt: new Date("2026-05-31T10:00:00.000Z"),
        }),
        createNotificationRow({
          id: "mine_expired",
          expiresAt: new Date("2026-05-30T12:00:00.000Z"),
        }),
        createNotificationRow({
          id: "theirs_unread",
          recipientUserId: "other_user",
        }),
      ],
    });

    await expect(
      handleNotificationAction({
        formData: createActionFormData({ intent: "mark_all_read" }),
        now,
        session: completedSession,
        store: notifications.store,
      }),
    ).resolves.toEqual({
      status: "marked_all_read",
      redirectTo: "/dashboard/notifications",
    });

    expect(
      notifications.rows.find((row) => row.id === "mine_unread")?.readAt,
    ).toBe(now);
    expect(
      notifications.rows.find((row) => row.id === "mine_read")?.readAt,
    ).toEqual(new Date("2026-05-31T10:00:00.000Z"));
    expect(
      notifications.rows.find((row) => row.id === "mine_expired")?.readAt,
    ).toBeNull();
    expect(
      notifications.rows.find((row) => row.id === "theirs_unread")?.readAt,
    ).toBeNull();
  });
});

function createNotificationStore({
  rows,
}: {
  rows: NotificationRow[];
}) {
  const store: NotificationStore = {
    countUnreadNotifications({ now: currentTime, recipientUserId }) {
      return Promise.resolve(
        rows.filter(
          (row) =>
            row.recipientUserId === recipientUserId &&
            row.readAt === null &&
            row.expiresAt > currentTime,
        ).length,
      );
    },
    findNotificationByIdForRecipient({ id, now: currentTime, recipientUserId }) {
      return Promise.resolve(
        rows.find(
          (row) =>
            row.id === id &&
            row.recipientUserId === recipientUserId &&
            row.expiresAt > currentTime,
        ),
      );
    },
    findNotificationsForRecipient({ limit, now: currentTime, recipientUserId }) {
      return Promise.resolve(
        rows
          .filter(
            (row) =>
              row.recipientUserId === recipientUserId &&
              row.expiresAt > currentTime,
          )
          .sort(
            (left, right) =>
              right.createdAt.getTime() - left.createdAt.getTime(),
          )
          .slice(0, limit),
      );
    },
    markAllNotificationsRead({ now: currentTime, recipientUserId }) {
      for (const row of rows) {
        if (
          row.recipientUserId === recipientUserId &&
          row.readAt === null &&
          row.expiresAt > currentTime
        ) {
          row.readAt = currentTime;
        }
      }

      return Promise.resolve();
    },
    markNotificationRead({ id, now: currentTime, recipientUserId }) {
      const row = rows.find(
        (candidate) =>
          candidate.id === id && candidate.recipientUserId === recipientUserId,
      );

      if (row !== undefined) {
        row.readAt = currentTime;
      }

      return Promise.resolve();
    },
  };

  return { rows, store };
}

function createNotificationRow(
  overrides: Partial<NotificationRow> = {},
): NotificationRow {
  return {
    id: "notification_1",
    recipientUserId: "user_1",
    type: "question_answered",
    actorUserId: "actor_user",
    threadId: "thread_1",
    threadItemId: "item_1",
    questionId: "question_1",
    readAt: null,
    createdAt: now,
    expiresAt: new Date("2026-11-27T12:00:00.000Z"),
    actorUsername: "actor",
    actorDisplayName: "Actor",
    actorAvatarUrl: null,
    actorIsActive: true,
    actorUserDeletedAt: null,
    ownerUsername: "person",
    ownerIsActive: true,
    ownerUserDeletedAt: null,
    threadPublicId: "thread_public_1",
    threadStatus: "published",
    threadItemPublicId: "item_public_1",
    threadItemStatus: "published",
    threadItemDeletedAt: null,
    questionPublicId: "qst_1",
    questionStatus: "answered",
    questionDeletedAt: null,
    questionIdentityMode: "account_attributed",
    ...overrides,
  };
}

function createActionFormData(
  submission:
    | { intent: "mark_all_read" }
    | {
        intent: "mark_read";
        notificationId: string;
        redirectTo?: "notifications";
      },
) {
  const formData = new FormData();

  formData.set("intent", submission.intent);

  if (submission.intent === "mark_read") {
    formData.set("notificationId", submission.notificationId);
    if (submission.redirectTo !== undefined) {
      formData.set("redirectTo", submission.redirectTo);
    }
  }

  return formData;
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
