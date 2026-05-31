import { Form, Link } from "react-router";

import { EmptyState } from "~/components/app/empty-state";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import type { NotificationView } from "~/features/notifications/notification.server";

interface NotificationListProps {
  notifications: NotificationView[];
}

export function NotificationList({ notifications }: NotificationListProps) {
  if (notifications.length === 0) {
    return (
      <EmptyState
        description="Activity from answered questions, follow-ups, likes, and follows will appear here."
        title="No notifications"
      />
    );
  }

  return (
    <section aria-label="Notifications" className="flex flex-col gap-3">
      {notifications.map((notification) => (
        <NotificationCard key={notification.id} notification={notification} />
      ))}
    </section>
  );
}

function NotificationCard({
  notification,
}: {
  notification: NotificationView;
}) {
  const unread = notification.readAt === null;
  const hasAction = notification.targetHref !== undefined || unread;

  return (
    <article
      className={cn(
        "flex flex-col gap-4 rounded-lg border bg-card p-5 text-card-foreground shadow-sm sm:flex-row sm:items-start sm:justify-between",
        unread ? "border-foreground/20" : "border-border",
      )}
    >
      <div className="flex min-w-0 gap-3">
        <span
          aria-hidden="true"
          className={cn(
            "mt-1 size-2.5 shrink-0 rounded-full",
            unread ? "bg-primary" : "bg-muted",
          )}
        />
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-col gap-1">
            <p className="break-words text-sm font-medium leading-6">
              {notification.message}
            </p>
            <time
              className="text-sm leading-6 text-muted-foreground"
              dateTime={notification.createdAt}
            >
              {formatNotificationDate(notification.createdAt)}
            </time>
          </div>
          {notification.actor === undefined ? null : (
            <Link
              className="flex w-fit min-w-0 items-center gap-2 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              to={notification.actor.href}
            >
              <ActorAvatar actor={notification.actor} />
              <span className="min-w-0 truncate">
                {notification.actor.displayName} @{notification.actor.username}
              </span>
            </Link>
          )}
        </div>
      </div>

      {hasAction ? (
        <Form method="post">
          <input name="intent" type="hidden" value="mark_read" />
          <input name="notificationId" type="hidden" value={notification.id} />
          <Button size="sm" type="submit" variant="outline">
            {notification.targetHref === undefined ? "Mark read" : "Open"}
          </Button>
        </Form>
      ) : null}
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
        className="size-6 shrink-0 rounded-md border bg-muted object-cover"
        src={actor.avatarUrl}
      />
    );
  }

  return (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-secondary text-xs font-semibold text-secondary-foreground">
      {actor.displayName.slice(0, 1).toUpperCase()}
    </span>
  );
}

function formatNotificationDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
