import { CheckCheck } from "lucide-react";
import {
  data,
  redirect,
  useActionData,
  Form,
  useOutletContext,
} from "react-router";

import type { Route } from "./+types/notifications.route";
import { ActionToast } from "~/components/shared/action-toast/action-toast";
import type { AppShellData } from "~/types/app-shell-data";
import { PageHeader } from "~/components/shared/page-header/page-header";
import { PendingButton } from "~/components/shared/pending-button/pending-button";
import { ToastResultInput } from "~/components/shared/toast-result/toast-result-input";
import { wantsToastResult } from "~/components/shared/toast-result/toast-result";
import { Badge } from "~/components/ui/badge/badge";
import { Button } from "~/components/ui/button/button";
import { requireCompletedProfileSessionFromContext } from "~/features/auth/services/auth.service.server";
import { NotificationList } from "~/features/notifications/components/notification-list";
import {
  handleNotificationAction,
  loadNotifications,
  type NotificationActionResult,
} from "~/features/notifications/services/notification.service.server";

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
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <PageHeader
          actions={
            <>
              <Badge variant="secondary">{unreadCount} unread</Badge>
              {unreadCount > 0 ? (
                <Form method="post">
                  <ToastResultInput />
                  <input name="intent" type="hidden" value="mark_all_read" />
                  <PendingButton
                    pendingName="intent"
                    pendingText="Marking…"
                    pendingValue="mark_all_read"
                    type="submit"
                    variant="outline"
                  >
                    <CheckCheck data-icon="inline-start" />
                    Mark all read
                  </PendingButton>
                </Form>
              ) : (
                <Button disabled variant="outline">
                  <CheckCheck data-icon="inline-start" />
                  Mark all read
                </Button>
              )}
            </>
          }
          description="Items deep-link to inbox questions, public threads, or member profiles."
          title="Notifications"
        />

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
