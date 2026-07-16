import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AppShellData } from "~/types/app-shell-data";

const routerState = vi.hoisted(() => ({
  locationPathname: "/feed",
  navigationPathname: undefined as string | undefined,
  revalidate: vi.fn(),
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
    useRevalidator: () => ({
      revalidate: routerState.revalidate,
      state: "idle",
    }),
  };
});

import { AppShell } from "~/components/layout/app-shell/app-shell";

describe("AppShell navigation", () => {
  afterEach(() => {
    vi.useRealTimers();
    routerState.revalidate.mockClear();
  });

  it("keeps the rendered page active while marking the pending destination", () => {
    routerState.locationPathname = "/feed";
    routerState.navigationPathname = "/notifications";

    render(
      <AppShell shell={shellData}>
        <div>Page</div>
      </AppShell>,
    );

    expect(screen.getByRole("link", { name: "Feed" })).toHaveAttribute(
      "data-active",
    );
    expect(screen.getByRole("link", { name: "Feed" })).toHaveAttribute(
      "data-prefetch",
      "viewport",
    );
    expect(
      screen.getByRole("link", { name: "Notifications" }),
    ).not.toHaveAttribute("data-active");
    expect(
      screen.getByRole("link", { name: "Notifications" }),
    ).toHaveAttribute("data-pending");
    expect(
      screen.getByRole("link", { name: "Notifications" }),
    ).toHaveAttribute(
      "data-prefetch",
      "viewport",
    );
  });

  it("refreshes shell data while the document remains visible", () => {
    vi.useFakeTimers();
    routerState.locationPathname = "/feed";
    routerState.navigationPathname = undefined;

    render(
      <AppShell shell={shellData}>
        <div>Page</div>
      </AppShell>,
    );

    vi.advanceTimersByTime(60_000);

    expect(routerState.revalidate).toHaveBeenCalledOnce();
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
