import { Bell, House, Inbox, Settings, UserRound } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { useLocation, useNavigation, useRevalidator } from "react-router";

import type { AppShellData } from "~/types/app-shell-data";
import {
  FloatingPillNav,
  type FloatingPillNavItem,
} from "~/components/layout/floating-pill-nav/floating-pill-nav";
import { cn } from "~/lib/utils";

interface AppShellProps {
  shell: AppShellData;
  children: ReactNode;
}

const SHELL_REFRESH_INTERVAL_MILLISECONDS = 60_000;

export function AppShell({ children, shell }: AppShellProps) {
  const location = useLocation();
  const navigation = useNavigation();
  useRefreshAppShell();
  const navigationLocation = navigation.location as
    | { pathname: string }
    | undefined;
  const isRouteLoading =
    navigation.state === "loading" &&
    navigationLocation?.pathname !== location.pathname;
  const appNavigation = getAppNavigation({
    hasUnreadNotifications: shell.unreadNotificationCount > 0,
    profileHref: shell.profileHref,
  });
  const activeValue = getActiveNavigationValue({
    pathname: location.pathname,
    profileHref: shell.profileHref,
  });
  const pendingValue = navigationLocation
    ? getActiveNavigationValue({
        pathname: navigationLocation.pathname,
        profileHref: shell.profileHref,
      })
    : undefined;

  const normalizedPendingValue =
    isRouteLoading && pendingValue !== activeValue ? pendingValue : undefined;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main
        aria-busy={isRouteLoading || undefined}
        className={cn(
          "mx-auto w-full max-w-7xl px-4 pb-[calc(8.5rem+env(safe-area-inset-bottom))] pt-8 transition-opacity duration-150 sm:px-6 sm:pt-10 lg:px-8",
          isRouteLoading && "opacity-70",
        )}
      >
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
        pendingValue={normalizedPendingValue}
      />
    </div>
  );
}

function useRefreshAppShell() {
  const { revalidate, state } = useRevalidator();

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible" && state === "idle") {
        void revalidate();
      }
    }, SHELL_REFRESH_INTERVAL_MILLISECONDS);

    return () => {
      window.clearInterval(interval);
    };
  }, [revalidate, state]);
}

interface AppNavigationInput {
  hasUnreadNotifications: boolean;
  profileHref: string;
}

function getAppNavigation({
  hasUnreadNotifications,
  profileHref,
}: AppNavigationInput): readonly FloatingPillNavItem[] {
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
  ] as const;
}

function getActiveNavigationValue({
  pathname,
  profileHref,
}: {
  pathname: string;
  profileHref: string;
}) {
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
