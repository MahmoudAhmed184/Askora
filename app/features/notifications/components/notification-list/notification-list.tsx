import {
  Bell,
  Heart,
  Inbox,
  MessageCircle,
  PenLine,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { Form, Link, useFetcher, useLocation } from "react-router";

import { EmptyState } from "~/components/shared/empty-state/empty-state";
import { ToastResultInput } from "~/components/shared/toast-result/toast-result-input";
import { Badge } from "~/components/ui/badge/badge";
import { Button } from "~/components/ui/button/button";
import { createAnswerModalLink } from "~/features/answers/answer-modal";
import { getAvatarImageSource } from "~/features/profiles/avatar-url";
import { createThreadModalLink } from "~/features/threads/thread-modal";
import { formatMediumDateTime } from "~/lib/date-format";
import { cn } from "~/lib/utils";
import type { NotificationView } from "~/features/notifications/types/notifications.types";

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
      <EmptyState
        description="Activity from answered questions, follow-ups, likes, and follows will appear here."
        icon={<Bell aria-hidden="true" />}
        title="No activity yet"
      />
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
  const fetcher = useFetcher();
  const location = useLocation();
  const unread = notification.readAt === null;
  const hasAction = notification.targetHref !== undefined || unread;
  const Icon = notificationIcons[notification.type];
  const targetLink =
    notification.targetHref === undefined
      ? undefined
      : createNotificationTargetLink({
          href: notification.targetHref,
          location,
        });

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
        <Icon aria-hidden="true" className="size-4" />
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
              {targetLink === undefined ? null : (
                <Button asChild className="w-full" size="sm">
                  <Link
                    id={targetLink.focusReturnId}
                    onClick={() => {
                      if (unread) {
                        markNotificationRead({ fetcher, notification });
                      }
                    }}
                    prefetch="intent"
                    to={targetLink.to}
                    {...getMaskedTargetLinkProps(targetLink)}
                  >
                    {getNotificationActionLabel(notification.type)}
                  </Link>
                </Button>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function markNotificationRead({
  fetcher,
  notification,
}: {
  fetcher: ReturnType<typeof useFetcher>;
  notification: NotificationView;
}) {
  const formData = new FormData();

  formData.set("intent", "mark_read");
  formData.set("notificationId", notification.id);
  formData.set("redirectTo", "notifications");

  void fetcher.submit(formData, { method: "post" });
}

function createNotificationTargetLink({
  href,
  location,
}: {
  href: string;
  location: {
    hash: string;
    pathname: string;
    search: string;
  };
}) {
  const threadTarget = parsePublicThreadHref(href);

  if (threadTarget !== undefined) {
    return createThreadModalLink({
      canonicalHash: threadTarget.hash,
      location,
      threadPublicId: threadTarget.threadPublicId,
      username: threadTarget.username,
    });
  }

  const answerTarget = parseAnswerHref(href);

  if (answerTarget !== undefined) {
    return createAnswerModalLink({
      location,
      questionPublicId: answerTarget.questionPublicId,
    });
  }

  return {
    focusReturnId: undefined,
    mask: undefined,
    to: href,
  };
}

function getMaskedTargetLinkProps({
  mask,
}: ReturnType<typeof createNotificationTargetLink>) {
  if (mask === undefined) {
    return {};
  }

  return {
    defaultShouldRevalidate: false,
    mask,
    preventScrollReset: true,
  };
}

function parsePublicThreadHref(href: string) {
  if (!href.startsWith("/")) {
    return undefined;
  }

  const url = new URL(href, "https://askora.local");
  const match = /^\/([^/]+)\/a\/([^/]+)$/.exec(url.pathname);

  if (match === null) {
    return undefined;
  }

  return {
    hash: url.hash,
    threadPublicId: decodeURIComponent(match[2] ?? ""),
    username: decodeURIComponent(match[1] ?? ""),
  };
}

function parseAnswerHref(href: string) {
  if (!href.startsWith("/")) {
    return undefined;
  }

  const url = new URL(href, "https://askora.local");
  const match = /^\/answer\/([^/]+)$/.exec(url.pathname);

  if (match?.[1] === undefined) {
    return undefined;
  }

  return { questionPublicId: decodeURIComponent(match[1]) };
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
        src={getAvatarImageSource(actor.avatarUrl)}
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
