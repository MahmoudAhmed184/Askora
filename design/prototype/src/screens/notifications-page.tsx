import * as React from "react";
import {
  Bell,
  CheckCheck,
  Heart,
  Inbox,
  MessageCircle,
  PenLine,
  UserPlus,
  type LucideIcon,
} from "lucide-react";

import { GeminiNotification } from "../components/notifications/gemini-notification";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { cn } from "../lib/utils";

type ToastState = {
  message: string;
  tone: "danger" | "success";
};

type NotificationItem =
  | {
      actionLabel: string;
      id: string;
      kind: "question";
      message: string;
      target: string;
      time: string;
      unread: boolean;
    }
  | {
      actionLabel: string;
      actor: string;
      comments: number;
      excerpt: string;
      id: string;
      initials: string;
      kind: "answer";
      likes: number;
      question: string;
      target: string;
      time: string;
      unread: boolean;
    }
  | {
      actionLabel: string;
      actor: string;
      id: string;
      kind: "like";
      message: string;
      target: string;
      time: string;
      unread: boolean;
    }
  | {
      actionLabel: string;
      actor: string;
      handle: string;
      id: string;
      initials: string;
      kind: "follow";
      target: string;
      time: string;
      unread: boolean;
    };

const notifications = [
  {
    actionLabel: "Inbox",
    id: "notification-question",
    kind: "question",
    message: "New anonymous question: How do you stay consistent?",
    target: "/inbox?q=q-card-1",
    time: "8m ago",
    unread: true,
  },
  {
    actionLabel: "Open answer",
    actor: "Maya Chen",
    comments: 12,
    excerpt:
      "I use anchors, not full schedules. Two reliable anchors per day are easier to protect than a perfect plan that breaks by lunch.",
    id: "notification-answer",
    initials: "MC",
    kind: "answer",
    likes: 428,
    question:
      "How do you stay consistent without turning your whole life into a schedule?",
    target: "/mayachen/a/thread-2J4",
    time: "31m ago",
    unread: true,
  },
  {
    actionLabel: "Open thread",
    actor: "Alex Leyton",
    id: "notification-like",
    kind: "like",
    message: "liked your answer on study anchors.",
    target: "/mayachen/a/thread-2J4",
    time: "42m ago",
    unread: false,
  },
  {
    actionLabel: "Open profile",
    actor: "Sarah Miller",
    handle: "@sarahm",
    id: "notification-follow",
    initials: "SM",
    kind: "follow",
    target: "/sarahm",
    time: "Yesterday",
    unread: false,
  },
] as const satisfies readonly NotificationItem[];

const notificationIcons = {
  answer: PenLine,
  follow: UserPlus,
  like: Heart,
  question: Inbox,
} as const satisfies Record<NotificationItem["kind"], LucideIcon>;

export function NotificationsPage() {
  const [unreadIds, setUnreadIds] = React.useState<ReadonlySet<string>>(
    () =>
      new Set(
        notifications
          .filter((notification) => notification.unread)
          .map((notification) => notification.id),
      ),
  );
  const [toast, setToast] = React.useState<ToastState | null>(null);

  React.useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setToast(null);
    }, 2600);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [toast]);

  function triggerToast(message: string, tone: ToastState["tone"] = "success") {
    setToast({ message, tone });
  }

  function markRead(notificationId: string) {
    setUnreadIds((current) => {
      const next = new Set(current);
      next.delete(notificationId);
      return next;
    });
    triggerToast("Notification marked read.");
  }

  function markAllRead() {
    setUnreadIds(new Set());
    triggerToast("All notifications marked read.");
  }

  return (
    <div className="gemini-profile">
      <main className="gemini-app-shell" role="main">
        <section className="gemini-feed-container mx-auto max-w-4xl">
          <div className="gemini-content-card">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="gemini-feed-title">
                  Notification Center <span>{unreadIds.size} unread</span>
                </h1>
                <p className="text-sm leading-6 text-muted-foreground">
                  Items deep-link to inbox questions, public threads, or member
                  profiles.
                </p>
              </div>
              <Button onClick={markAllRead} type="button" variant="outline">
                <CheckCheck data-icon="inline-start" />
                Mark all read
              </Button>
            </div>
          </div>

          <div className="gemini-content-card overflow-hidden p-0">
            <div className="relative p-5 sm:p-7">
              <div className="relative flex flex-col gap-6">
                {notifications.map((notification, index) => (
                  <NotificationTimelineItem
                    isLast={index === notifications.length - 1}
                    isUnread={unreadIds.has(notification.id)}
                    key={notification.id}
                    notification={notification}
                    onMarkRead={markRead}
                    onToast={triggerToast}
                  />
                ))}
              </div>
            </div>
          </div>

          {unreadIds.size === 0 ? (
            <div className="rounded-[0.625rem] border border-success/25 bg-success/10 px-3.5 py-3 text-sm leading-6 text-foreground">
              All notifications are read.
            </div>
          ) : null}
        </section>
      </main>

      <GeminiNotification
        message={toast?.message ?? ""}
        open={Boolean(toast)}
        tone={toast?.tone ?? "success"}
      />
    </div>
  );
}

function NotificationTimelineItem({
  isLast,
  isUnread,
  notification,
  onMarkRead,
  onToast,
}: {
  isLast: boolean;
  isUnread: boolean;
  notification: NotificationItem;
  onMarkRead: (id: string) => void;
  onToast: (message: string, tone?: ToastState["tone"]) => void;
}) {
  const Icon = notificationIcons[notification.kind] ?? Bell;

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
          "z-10 flex size-9 shrink-0 items-center justify-center rounded-full border bg-secondary text-primary shadow-[0_0_0_4px_var(--bg-card)]",
          isUnread && "border-primary/25 bg-primary/10",
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
              {isUnread ? <Badge variant="violet">Unread</Badge> : null}
              <span className="font-mono text-[0.68rem] text-muted-foreground">
                {notification.time}
              </span>
            </div>

            {notification.kind === "answer" ? (
              <AnswerNotificationContent notification={notification} />
            ) : null}

            {notification.kind === "question" ? (
              <SimpleNotificationContent
                message={notification.message}
                target={notification.target}
              />
            ) : null}

            {notification.kind === "like" ? (
              <SimpleNotificationContent
                message={
                  <span className="inline-flex flex-wrap gap-x-1">
                    <span>{notification.actor}</span>
                    <span>{notification.message}</span>
                  </span>
                }
                target={notification.target}
              />
            ) : null}

            {notification.kind === "follow" ? (
              <SimpleNotificationContent
                message={
                  <span className="inline-flex flex-wrap gap-x-1">
                    <span>{notification.actor}</span>
                    <span>followed you.</span>
                  </span>
                }
                target={`${notification.handle} · ${notification.target}`}
              />
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2 sm:flex-col sm:items-stretch">
            <Button
              className="sm:w-full"
              disabled={!isUnread}
              onClick={() => {
                onMarkRead(notification.id);
              }}
              size="sm"
              type="button"
              variant="outline"
            >
              Mark read
            </Button>
            <Button
              className="sm:w-full"
              onClick={() => {
                onMarkRead(notification.id);
                onToast(notification.actionLabel);
              }}
              size="sm"
              type="button"
            >
              {notification.actionLabel}
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}

function AnswerNotificationContent({
  notification,
}: {
  notification: Extract<NotificationItem, { kind: "answer" }>;
}) {
  return (
    <div>
      <div className="mb-3 flex min-w-0 items-center gap-2">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-card font-serif text-[0.68rem] font-bold text-primary">
          {notification.initials}
        </span>
        <h2 className="flex min-w-0 flex-wrap items-baseline gap-x-1 text-sm font-bold text-foreground">
          <span>{notification.actor}</span>
          <span className="font-normal text-muted-foreground">answered</span>
        </h2>
      </div>

      <div className="border-l-2 border-border/70 pl-3">
        <h3 className="font-serif text-lg font-bold italic leading-snug text-primary">
          "{notification.question}"
        </h3>
      </div>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-foreground/90">
        {notification.excerpt}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-4">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
          <Heart data-icon="inline-start" />
          {notification.likes}
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
          <MessageCircle data-icon="inline-start" />
          {notification.comments}
        </span>
      </div>
    </div>
  );
}

function SimpleNotificationContent({
  message,
  target,
}: {
  message: React.ReactNode;
  target: string;
}) {
  return (
    <>
      <h2 className="text-sm font-bold text-foreground">{message}</h2>
      <p className="mt-2 break-all font-mono text-[0.68rem] text-muted-foreground">
        {target}
      </p>
    </>
  );
}
