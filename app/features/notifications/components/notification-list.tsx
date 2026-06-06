import {
  Bell,
  Heart,
  Inbox,
  MessageCircle,
  PenLine,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { Form, Link } from "react-router";

import { ToastResultInput } from "~/components/app/toast-result-input";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { formatMediumDateTime } from "~/lib/date-format";
import { cn } from "~/lib/utils";
import type { NotificationView } from "~/features/notifications/notification.server";

interface NotificationListProps {
  notifications: NotificationView[];
}

const notificationIcons = {
  answer_liked: Heart,
  follow_up_answered: MessageCircle,
  follow_up_asked: Inbox,
  profile_followed: UserPlus,
  question_answered: PenLine,
} as const satisfies Record<NotificationView["type"], LucideIcon>;

export function NotificationList({ notifications }: NotificationListProps) {
  if (notifications.length === 0) {
    return (
      <section className="rounded-3xl border bg-card p-6 text-card-foreground shadow-[var(--shadow-card)] sm:p-7">
        <div className="flex gap-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full border bg-secondary text-primary">
            <Bell data-icon="inline-start" />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-foreground">No activity yet</h2>
            <p className="mt-2 max-w-prose text-sm leading-6 text-muted-foreground">
              Activity from answered questions, follow-ups, likes, and follows
              will appear here.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label="Notifications"
      className="overflow-hidden rounded-3xl border bg-card text-card-foreground shadow-[var(--shadow-card)]"
    >
      <div className="p-5 sm:p-7">
        <div className="relative flex flex-col gap-6">
          {notifications.map((notification, index) => (
            <NotificationTimelineItem
              isLast={index === notifications.length - 1}
              key={notification.id}
              notification={notification}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function NotificationTimelineItem({
  isLast,
  notification,
}: {
  isLast: boolean;
  notification: NotificationView;
}) {
  const unread = notification.readAt === null;
  const hasAction = notification.targetHref !== undefined || unread;
  const Icon = notificationIcons[notification.type];

  return (
    <article className="relative flex gap-4">
      {!isLast ? (
        <span
          aria-hidden="true"
          className="absolute -bottom-6 left-[1.125rem] top-9 w-px bg-border/80"
        />
      ) : null}
      <span
        className={cn(
          "z-10 flex size-9 shrink-0 items-center justify-center rounded-full border bg-secondary text-primary shadow-[0_0_0_4px_var(--card)]",
          unread && "border-primary/25 bg-primary/10",
        )}
      >
        <Icon aria-hidden="true" size={16} strokeWidth={2.4} />
      </span>

      <div
        className={cn(
          "min-w-0 flex-1 pb-6",
          !isLast && "border-b border-border",
        )}
      >
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9.5rem] sm:items-start">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {unread ? <Badge variant="secondary">Unread</Badge> : null}
              <time
                className="font-mono text-[0.68rem] text-muted-foreground"
                dateTime={notification.createdAt}
              >
                {formatNotificationDate(notification.createdAt)}
              </time>
            </div>
            <p className="break-words text-sm font-bold leading-6 text-foreground">
              {notification.message}
            </p>
            {notification.actor === undefined ? null : (
              <Link
                className="mt-3 flex w-fit min-w-0 items-center gap-2 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                to={notification.actor.href}
              >
                <ActorAvatar actor={notification.actor} />
                <span className="min-w-0 truncate">
                  {notification.actor.displayName} @{notification.actor.username}
                </span>
              </Link>
            )}
          </div>

          {hasAction ? (
            <div className="flex flex-wrap gap-2 sm:flex-col sm:items-stretch">
              {unread ? (
                <Form className="sm:w-full" method="post">
                  <ToastResultInput />
                  <input name="intent" type="hidden" value="mark_read" />
                  <input
                    name="notificationId"
                    type="hidden"
                    value={notification.id}
                  />
                  <input name="redirectTo" type="hidden" value="notifications" />
                  <Button
                    className="w-full"
                    size="sm"
                    type="submit"
                    variant="outline"
                  >
                    Mark read
                  </Button>
                </Form>
              ) : (
                <Button
                  className="w-full sm:w-full"
                  disabled
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Mark read
                </Button>
              )}
              {notification.targetHref === undefined ? null : (
                <Form className="sm:w-full" method="post">
                  <input name="intent" type="hidden" value="mark_read" />
                  <input
                    name="notificationId"
                    type="hidden"
                    value={notification.id}
                  />
                  <Button className="w-full" size="sm" type="submit">
                    {getNotificationActionLabel(notification.type)}
                  </Button>
                </Form>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function ActorAvatar({
  actor,
}: {
  actor: NonNullable<NotificationView["actor"]>;
}) {
  if (actor.avatarUrl !== null) {
    return (
      <img
        alt=""
        className="size-6 shrink-0 rounded-full border bg-muted object-cover"
        decoding="async"
        loading="lazy"
        src={actor.avatarUrl}
      />
    );
  }

  return (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
      {actor.displayName.slice(0, 1).toUpperCase()}
    </span>
  );
}

function getNotificationActionLabel(type: NotificationView["type"]) {
  switch (type) {
    case "answer_liked":
      return "Open thread";
    case "follow_up_asked":
      return "Inbox";
    case "follow_up_answered":
    case "question_answered":
      return "Open answer";
    case "profile_followed":
      return "Open profile";
  }
}

function formatNotificationDate(value: string) {
  return formatMediumDateTime(value);
}
