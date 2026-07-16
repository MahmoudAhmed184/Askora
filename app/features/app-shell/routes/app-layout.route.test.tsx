import { render, screen } from "@testing-library/react";
import type { ComponentType } from "react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import {
  ErrorBoundary,
  shouldRevalidate,
} from "~/features/app-shell/routes/app-layout.route";
import type { AppShellData } from "~/types/app-shell-data";

beforeAll(() => {
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    },
  );
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe("app layout route", () => {
  it("uses normal GET revalidation so shell counts do not freeze", () => {
    expect(
      shouldRevalidate({
        defaultShouldRevalidate: true,
      } as Parameters<typeof shouldRevalidate>[0]),
    ).toBe(true);
  });

  it("keeps signed-in navigation around a nested route error", () => {
    const Boundary = ErrorBoundary as ComponentType<{
      error: unknown;
      loaderData: { shell: AppShellData };
    }>;
    const router = createMemoryRouter([
      {
        path: "/",
        element: (
          <Boundary
            error={new Error("private database detail")}
            loaderData={{ shell }}
          />
        ),
      },
    ]);

    render(<RouterProvider router={router} />);

    expect(screen.getByRole("heading", { name: "Something went wrong" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Feed" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Return to feed" })).toBeInTheDocument();
    expect(screen.queryByText("private database detail")).not.toBeInTheDocument();
  });
});

const shell = {
  profileHref: "/person",
  session: {
    profile: {
      username: "person",
      displayName: "Person",
    },
  },
  unreadNotificationCount: 1,
} satisfies AppShellData;
