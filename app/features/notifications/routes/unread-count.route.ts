import type { Route } from "./+types/unread-count.route";

import type { UnreadNotificationCountData } from "~/types/app-shell-data";
import { requireCompletedProfileSessionFromContext } from "~/features/auth/services/auth.service.server";
import { getUnreadNotificationCount } from "~/features/notifications/services/notification.service.server";

type ReadUnreadNotificationCount = typeof getUnreadNotificationCount;

export async function loader(
  { context }: Route.LoaderArgs,
  readUnreadNotificationCount: ReadUnreadNotificationCount =
    getUnreadNotificationCount,
) {
  const session = requireCompletedProfileSessionFromContext(context);

  if (session instanceof Response) {
    return session;
  }

  const unreadNotificationCount = await readUnreadNotificationCount({
    recipientUserId: session.user.id,
  });
  const responseData = {
    profileHref: `/${session.profile.username}`,
    unreadNotificationCount,
  } satisfies UnreadNotificationCountData;

  return Response.json(responseData, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
