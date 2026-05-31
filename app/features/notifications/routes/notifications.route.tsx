import { data, redirect, useActionData, Form } from "react-router";

import type { Route } from "./+types/notifications.route";
import { DashboardShell } from "~/components/app/dashboard-shell";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { NotificationList } from "~/features/notifications/components/notification-list";
import {
  handleNotificationAction,
  loadNotifications,
  type NotificationActionResult,
} from "~/features/notifications/notification.server";

interface NotificationsRouteActionData {
  notification: NotificationActionResult;
}

export async function loader({ request }: Route.LoaderArgs) {
  const { requireCompletedProfileSession } = await import(
    "~/features/auth/auth.server"
  );
  const session = await requireCompletedProfileSession(request);

  if (session instanceof Response) {
    return session;
  }

  return {
    page: await loadNotifications({ session }),
  };
}

export async function action({ request }: Route.ActionArgs) {
  const { requireCompletedProfileSession } = await import(
    "~/features/auth/auth.server"
  );
  const session = await requireCompletedProfileSession(request);

  if (session instanceof Response) {
    return session;
  }

  const result = await handleNotificationAction({
    formData: await request.formData(),
    session,
  });

  if (result.status !== "invalid") {
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
  const unreadCount = loaderData.page.unreadCount;

  return (
    <DashboardShell>
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Notifications</Badge>
              <Badge variant="outline">{unreadCount} unread</Badge>
            </div>
            <div className="flex flex-col gap-2">
              <h1 className="text-3xl font-semibold tracking-normal">
                Notifications
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                Recent activity from your questions, answers, and profile.
              </p>
            </div>
          </div>

          {unreadCount > 0 ? (
            <Form method="post">
              <input name="intent" type="hidden" value="mark_all_read" />
              <Button type="submit" variant="outline">
                Mark all read
              </Button>
            </Form>
          ) : null}
        </header>

        {actionData?.notification.status === "invalid" ? (
          <p className="text-sm leading-6 text-destructive" role="alert">
            {actionData.notification.formError}
          </p>
        ) : null}

        <NotificationList notifications={loaderData.page.notifications} />
      </div>
    </DashboardShell>
  );
}
