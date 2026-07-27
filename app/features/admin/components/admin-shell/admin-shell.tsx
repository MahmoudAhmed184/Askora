import {
  Bell,
  House,
  Inbox,
  Settings,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import type { ReactNode } from "react";
import { useLocation, useNavigation } from "react-router";

import type { AppShellData } from "~/types/app-shell-data";
import {
  FloatingPillNav,
  type FloatingPillNavItem,
} from "~/components/layout/floating-pill-nav/floating-pill-nav";

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
        className="app-nav-scrim pointer-events-none fixed inset-x-0 bottom-0 z-30 h-[calc(5.5rem+env(safe-area-inset-bottom))] sm:hidden"
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
    { value: "feed", to: "/feed", label: "Feed", icon: House },
    { value: "inbox", to: "/inbox", label: "Inbox", icon: Inbox },
    {
      value: "notifications",
      to: "/notifications",
      label: "Notifications",
      icon: Bell,
      hasIndicator: hasUnreadNotifications,
    },
    { value: "profile", to: profileHref, label: "Profile", icon: UserRound },
    {
      value: "settings",
      to: "/settings/profile",
      label: "Settings",
      icon: Settings,
    },
    { value: "admin", to: "/admin", label: "Admin", icon: ShieldCheck },
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
    pathname === "/inbox" ||
    pathname === "/drafts" ||
    pathname === "/filtered" ||
    pathname.startsWith("/answer/")
  ) {
    return "inbox";
  }

  if (pathname === "/notifications") {
    return "notifications";
  }

  if (pathname.startsWith("/settings")) {
    return "settings";
  }

  if (profileHref !== "/settings/profile" && pathname === profileHref) {
    return "profile";
  }

  return "feed";
}
