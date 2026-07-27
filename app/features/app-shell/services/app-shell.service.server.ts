import type { AppShellData } from "~/types/app-shell-data";
import type { CompletedProfileSessionSummary } from "~/features/auth/services/auth.service.server";
import { getUnreadNotificationCount } from "~/features/notifications/services/notification.service.server";

export async function loadAppShellData({
  session,
}: {
  session: CompletedProfileSessionSummary;
}): Promise<AppShellData> {
  return {
    session: {
      profile: {
        username: session.profile.username,
        displayName: session.profile.displayName,
      },
    },
    profileHref: `/${session.profile.username}`,
    unreadNotificationCount: await getUnreadNotificationCount({
      recipientUserId: session.user.id,
    }),
  };
}
