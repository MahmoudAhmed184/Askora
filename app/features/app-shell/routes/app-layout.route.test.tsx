import { render, screen } from "@testing-library/react";
import type { ComponentType } from "react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import {
  ErrorBoundary,
  shouldRevalidate,
} from "~/features/app-shell/routes/app-layout.route";

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

  it("keeps a safe return path around a nested route error", () => {
    const Boundary = ErrorBoundary as unknown as ComponentType<{
      error: unknown;
      loaderData: undefined;
    }>;
    const router = createMemoryRouter([
      {
        path: "/",
        element: (
          <Boundary
            error={new Error("private database detail")}
            loaderData={undefined}
          />
        ),
      },
    ]);

    render(<RouterProvider router={router} />);

    expect(
      screen.getByRole("heading", { name: "Something went wrong" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Return to feed" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("private database detail")).not.toBeInTheDocument();
  });
});
