import type { AppShellData } from "~/components/app/app-shell-data";
import type { CompletedProfileSessionSummary } from "~/features/auth/auth.server";
import { getUnreadNotificationCount } from "~/features/notifications/notification.server";

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
