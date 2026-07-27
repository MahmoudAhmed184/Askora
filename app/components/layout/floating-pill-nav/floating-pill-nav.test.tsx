import { render, screen } from "@testing-library/react";
import { Bell, House } from "lucide-react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";

import {
  FloatingPillNav,
  type FloatingPillNavItem,
} from "~/components/layout/floating-pill-nav/floating-pill-nav";

describe("FloatingPillNav", () => {
  it("renders an icon for every item and keeps labels in the accessible name", () => {
    const { container } = renderNav();

    expect(
      container.querySelectorAll("[data-slot='floating-pill-nav-icon']"),
    ).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Feed" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Notifications" }),
    ).toBeInTheDocument();
  });

  it("hides labels visually on mobile while keeping 44px targets", () => {
    const { container } = renderNav();

    const label = container.querySelector(
      "[data-slot='floating-pill-nav-label']",
    );

    expect(label).toHaveClass("sr-only", "sm:not-sr-only");
    // h-11 is 44px; the desktop override only shrinks it from the sm breakpoint.
    expect(screen.getByRole("link", { name: "Feed" })).toHaveClass(
      "h-11",
      "min-w-11",
      "sm:h-10",
    );
  });

  it("marks the active item and renders its notification indicator", () => {
    renderNav();

    const feed = screen.getByRole("link", { name: "Feed" });
    const notifications = screen.getByRole("link", { name: "Notifications" });

    expect(feed).toHaveAttribute("data-active");
    expect(feed).toHaveAttribute("aria-current", "page");
    expect(notifications).not.toHaveAttribute("data-active");
    expect(
      notifications.querySelector("[aria-hidden='true'].bg-accent"),
    ).toBeInTheDocument();
  });

  it("exposes a focus ring on every link", () => {
    renderNav();

    for (const name of ["Feed", "Notifications"]) {
      expect(screen.getByRole("link", { name })).toHaveClass(
        "focus-visible:ring-[3px]",
      );
    }
  });
});

function renderNav() {
  const items: FloatingPillNavItem[] = [
    { value: "feed", to: "/feed", label: "Feed", icon: House },
    {
      value: "notifications",
      to: "/notifications",
      label: "Notifications",
      icon: Bell,
      hasIndicator: true,
    },
  ];
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: <FloatingPillNav activeValue="feed" items={items} />,
      },
    ],
    { initialEntries: ["/"] },
  );

  return render(<RouterProvider router={router} />);
}
