import { Bell, House, Inbox, Settings, UserRound } from "lucide-react";
import { useEffect, useMemo, type ReactNode } from "react";
import { useFetcher, useLocation, useNavigation } from "react-router";

import type {
  AppShellData,
  UnreadNotificationCountData,
} from "~/types/app-shell-data";
import {
  FloatingPillNav,
  type FloatingPillNavItem,
} from "~/components/layout/floating-pill-nav/floating-pill-nav";
import {
  AppShellDataContext,
  useAppShellData,
} from "~/components/layout/app-shell/app-shell-data-context";
import { cn } from "~/lib/utils";

interface AppShellProps {
  children: ReactNode;
}

const UNREAD_NOTIFICATION_COUNT_REFRESH_INTERVAL_MILLISECONDS = 60_000;
const UNREAD_NOTIFICATION_COUNT_ENDPOINT =
  "/api/notifications/unread-count";

export function AppShellDataProvider({
  children,
  shell,
}: {
  children: ReactNode;
  shell: AppShellData | undefined;
}) {
  const unreadCountFetcher = useFetcher<UnreadNotificationCountData>();
  useRefreshUnreadNotificationCount({
    enabled: shell !== undefined,
    load: unreadCountFetcher.load,
    state: unreadCountFetcher.state,
  });
  const refreshedShell = useMemo(
    () => mergeUnreadNotificationCount(shell, unreadCountFetcher.data),
    [shell, unreadCountFetcher.data],
  );

  return (
    <AppShellDataContext.Provider value={refreshedShell}>
      {children}
    </AppShellDataContext.Provider>
  );
}

export function AppShell({ children }: AppShellProps) {
  const location = useLocation();
  const navigation = useNavigation();
  const navigationLocation = navigation.location as
    | { pathname: string }
    | undefined;
  const isRouteLoading =
    navigation.state === "loading" &&
    navigationLocation?.pathname !== location.pathname;

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
    </div>
  );
}

export function AppNavigation() {
  const shell = useAppShellData();
  const location = useLocation();
  const navigation = useNavigation();

  if (shell === undefined) {
    return null;
  }

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
    <>
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
    </>
  );
}

function useRefreshUnreadNotificationCount({
  enabled,
  load,
  state,
}: {
  enabled: boolean;
  load: (href: string) => Promise<void>;
  state: "idle" | "loading" | "submitting";
}) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible" && state === "idle") {
        void load(UNREAD_NOTIFICATION_COUNT_ENDPOINT);
      }
    }, UNREAD_NOTIFICATION_COUNT_REFRESH_INTERVAL_MILLISECONDS);

    return () => {
      window.clearInterval(interval);
    };
  }, [enabled, load, state]);
}

function mergeUnreadNotificationCount(
  shell: AppShellData | undefined,
  refreshedCount: UnreadNotificationCountData | undefined,
) {
  if (shell === undefined || refreshedCount?.profileHref !== shell.profileHref) {
    return shell;
  }

  return {
    ...shell,
    unreadNotificationCount: refreshedCount.unreadNotificationCount,
  };
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
