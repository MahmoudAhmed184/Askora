import { CheckCheck } from "lucide-react";
import {
  data,
  redirect,
  useActionData,
  Form,
  useOutletContext,
} from "react-router";

import type { Route } from "./+types/notifications.route";
import { ActionToast } from "~/components/app/action-toast";
import type { AppShellData } from "~/components/app/app-shell-data";
import { ToastResultInput } from "~/components/app/toast-result-input";
import { wantsToastResult } from "~/components/app/toast-result";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { requireCompletedProfileSessionFromContext } from "~/features/auth/auth.server";
import { NotificationList } from "~/features/notifications/components/notification-list";
import {
  handleNotificationAction,
  loadNotifications,
  type NotificationActionResult,
} from "~/features/notifications/notification.server";

interface NotificationsRouteActionData {
  notification: NotificationActionResult;
}

export async function loader({ context }: Route.LoaderArgs) {
  const session = requireCompletedProfileSessionFromContext(context);

  if (session instanceof Response) {
    return session;
  }

  return {
    page: await loadNotifications({ session }),
  };
}

export async function action({ context, request }: Route.ActionArgs) {
  const session = requireCompletedProfileSessionFromContext(context);

  if (session instanceof Response) {
    return session;
  }

  const formData = await request.formData();
  const result = await handleNotificationAction({
    formData,
    session,
  });

  if (result.status !== "invalid") {
    if (wantsToastResult(formData)) {
      return data<NotificationsRouteActionData>({ notification: result });
    }

    return redirect(result.redirectTo);
  }

  return data<NotificationsRouteActionData>(
    { notification: result },
    { status: 400 },
  );
}

export function meta() {
  return [{ title: "Notifications | qna-platform" }];
}

export default function NotificationsRoute({
  loaderData,
}: Route.ComponentProps) {
  const actionData = useActionData<typeof action>();
  const shell = useOutletContext<AppShellData>();
  const unreadCount = shell.unreadNotificationCount;
  const toastCopy = getNotificationToastCopy(actionData?.notification);

  return (
    <>
      <ActionToast
        message={toastCopy.message}
        tone={toastCopy.tone}
        trigger={actionData?.notification}
      />
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <header className="rounded-3xl border bg-card p-6 text-card-foreground shadow-[var(--shadow-card)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-serif text-2xl font-bold text-foreground">
                  Notification Center
                </h1>
                <Badge variant="secondary">{unreadCount} unread</Badge>
              </div>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Items deep-link to inbox questions, public threads, or member
                profiles.
              </p>
            </div>
            {unreadCount > 0 ? (
              <Form method="post">
                <ToastResultInput />
                <input name="intent" type="hidden" value="mark_all_read" />
                <Button className="w-full sm:w-auto" type="submit" variant="outline">
                  <CheckCheck data-icon="inline-start" />
                  Mark all read
                </Button>
              </Form>
            ) : (
              <Button className="w-full sm:w-auto" disabled variant="outline">
                <CheckCheck data-icon="inline-start" />
                Mark all read
              </Button>
            )}
          </div>
        </header>

        <NotificationList notifications={loaderData.page.notifications} />
      </div>
    </>
  );
}

function getNotificationToastCopy(
  result: NotificationActionResult | undefined,
): {
  message: string | undefined;
  tone: "error" | "success";
} {
  if (result === undefined) {
    return { message: undefined, tone: "success" };
  }

  if (result.status === "marked_read") {
    return { message: "Notification marked read.", tone: "success" };
  }

  if (result.status === "marked_all_read") {
    return { message: "All notifications marked read.", tone: "success" };
  }

  return { message: result.formError, tone: "error" };
}
