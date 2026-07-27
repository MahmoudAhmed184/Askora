import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AppShellData } from "~/types/app-shell-data";

const routerState = vi.hoisted(() => ({
  fetcherData: undefined as
    | { profileHref: string; unreadNotificationCount: number }
    | undefined,
  fetcherLoad: vi.fn(),
  fetcherState: "idle",
  locationPathname: "/feed",
  navigationPathname: undefined as string | undefined,
}));

vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");

  return {
    ...(actual as object),
    Link({ children, prefetch, to, ...props }: Record<string, unknown>) {
      return (
        <a
          {...props}
          data-prefetch={String(prefetch)}
          href={String(to)}
        >
          {children as ReactNode}
        </a>
      );
    },
    useLocation: () => ({ pathname: routerState.locationPathname }),
    useNavigation: () => ({
      location:
        routerState.navigationPathname === undefined
          ? undefined
          : { pathname: routerState.navigationPathname },
      state:
        routerState.navigationPathname === undefined ? "idle" : "loading",
    }),
    useFetcher: () => ({
      data: routerState.fetcherData,
      load: routerState.fetcherLoad,
      state: routerState.fetcherState,
    }),
  };
});

import {
  AppNavigation,
  AppShell,
  AppShellDataProvider,
} from "~/components/layout/app-shell/app-shell";

describe("AppShell navigation", () => {
  afterEach(() => {
    vi.useRealTimers();
    routerState.fetcherData = undefined;
    routerState.fetcherLoad.mockClear();
    routerState.fetcherState = "idle";
    routerState.locationPathname = "/feed";
    routerState.navigationPathname = undefined;
  });

  it("keeps the rendered page active while marking the pending destination", () => {
    routerState.locationPathname = "/feed";
    routerState.navigationPathname = "/notifications";

    render(
      <AppShellDataProvider shell={shellData}>
        <AppShell>
          <div>Page</div>
        </AppShell>
        <AppNavigation />
      </AppShellDataProvider>,
    );

    expect(screen.getByRole("link", { name: "Feed" })).toHaveAttribute(
      "data-active",
    );
    expect(
      screen.getByRole("link", { name: "Notifications" }),
    ).not.toHaveAttribute("data-active");
    expect(
      screen.getByRole("link", { name: "Notifications" }),
    ).toHaveAttribute("data-pending");
  });

  it("prefetches navbar destinations only after user intent", () => {
    routerState.locationPathname = "/feed";
    routerState.navigationPathname = undefined;

    render(
      <AppShellDataProvider shell={shellData}>
        <AppNavigation />
      </AppShellDataProvider>,
    );

    for (const name of [
      "Feed",
      "Inbox",
      "Notifications",
      "Profile",
      "Settings",
    ]) {
      expect(screen.getByRole("link", { name })).toHaveAttribute(
        "data-prefetch",
        "intent",
      );
    }
  });

  it("refreshes only the unread notification count while visible", () => {
    vi.useFakeTimers();
    routerState.locationPathname = "/feed";
    routerState.navigationPathname = undefined;

    render(
      <AppShellDataProvider shell={shellData}>
        <AppNavigation />
      </AppShellDataProvider>,
    );

    vi.advanceTimersByTime(60_000);

    expect(routerState.fetcherLoad).toHaveBeenCalledOnce();
    expect(routerState.fetcherLoad).toHaveBeenCalledWith(
      "/api/notifications/unread-count",
    );
  });

  it("uses the fetched unread count for the notification indicator", () => {
    routerState.fetcherData = {
      profileHref: shellData.profileHref,
      unreadNotificationCount: 0,
    };

    render(
      <AppShellDataProvider shell={shellData}>
        <AppNavigation />
      </AppShellDataProvider>,
    );

    expect(
      screen
        .getByRole("link", { name: "Notifications" })
        .querySelector("[aria-hidden='true'].bg-accent"),
    ).not.toBeInTheDocument();
  });
});

const shellData = {
  profileHref: "/person",
  session: {
    profile: {
      username: "person",
      displayName: "Person",
    },
  },
  unreadNotificationCount: 1,
} satisfies AppShellData;
