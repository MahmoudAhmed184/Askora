import type { ReactNode } from "react";
import { useLocation, useNavigation } from "react-router";

import type { AppShellData } from "~/components/app/app-shell-data";
import {
  FloatingPillNav,
  type FloatingPillNavItem,
} from "~/components/app/floating-pill-nav";

interface AdminShellProps {
  shell: AppShellData;
  children: ReactNode;
}

export function AdminShell({ children, shell }: AdminShellProps) {
  const location = useLocation();
  const navigation = useNavigation();
  const appNavigation = getAdminNavigation({
    hasUnreadNotifications: shell.unreadNotificationCount > 0,
    profileHref: shell.profileHref,
  });
  const activeValue = getActiveNavigationValue({
    pathname: navigation.location?.pathname ?? location.pathname,
    profileHref: shell.profileHref,
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto w-full max-w-7xl px-4 pb-[calc(8.5rem+env(safe-area-inset-bottom))] pt-8 sm:px-6 sm:pt-10 lg:px-8">
        {children}
      </main>
      <div
        aria-hidden="true"
        className="app-nav-scrim pointer-events-none fixed inset-x-0 bottom-0 z-40 h-[calc(5.5rem+env(safe-area-inset-bottom))] sm:hidden"
      />
      <FloatingPillNav
        activeValue={activeValue}
        ariaLabel="Primary app navigation"
        items={appNavigation}
      />
    </div>
  );
}

function getAdminNavigation({
  hasUnreadNotifications,
  profileHref,
}: {
  hasUnreadNotifications: boolean;
  profileHref: string;
}): readonly FloatingPillNavItem[] {
  return [
    { value: "feed", to: "/dashboard/feed", label: "Feed" },
    { value: "inbox", to: "/dashboard/inbox", label: "Inbox" },
    {
      value: "notifications",
      to: "/dashboard/notifications",
      label: "Notifications",
      mobileLabel: "Notifications",
      hasIndicator: hasUnreadNotifications,
    },
    { value: "profile", to: profileHref, label: "Profile" },
    { value: "settings", to: "/dashboard/settings/profile", label: "Settings" },
    { value: "admin", to: "/admin", label: "Admin" },
  ] as const;
}

function getActiveNavigationValue({
  pathname,
  profileHref,
}: {
  pathname: string;
  profileHref: string;
}) {
  if (pathname.startsWith("/admin")) {
    return "admin";
  }

  if (
    pathname === "/dashboard/inbox" ||
    pathname === "/dashboard/drafts" ||
    pathname === "/dashboard/filtered" ||
    pathname.startsWith("/dashboard/answer/")
  ) {
    return "inbox";
  }

  if (pathname === "/dashboard/notifications") {
    return "notifications";
  }

  if (pathname.startsWith("/dashboard/settings")) {
    return "settings";
  }

  if (profileHref !== "/dashboard/settings/profile" && pathname === profileHref) {
    return "profile";
  }

  return "feed";
}
