import { render, screen } from "@testing-library/react";
import { Bell, House } from "lucide-react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

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
    expect(
      screen.getByRole("navigation", { name: "Primary navigation" }),
    ).toHaveClass("sm:max-w-[46rem]");
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

  it("moves the capsule to the pending item before the active URL changes", () => {
    const getBoundingClientRect = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function getElementRectangle(this: HTMLElement) {
        if (this.getAttribute("data-slot") === "floating-pill-nav") {
          return rectangle({ left: 20, width: 240 });
        }

        return this.getAttribute("aria-label") === "Notifications"
          ? rectangle({ left: 140, width: 100 })
          : rectangle({ left: 30, width: 90 });
      });
    const { container, rerender } = renderNav();

    rerender(
      <MemoryRouter>
        <FloatingPillNav
          activeValue="feed"
          items={items}
          pendingValue="notifications"
        />
      </MemoryRouter>,
    );

    expect(
      container.querySelector("[data-slot='floating-pill-nav-capsule']"),
    ).toHaveStyle({ left: "120px", width: "100px" });
    expect(screen.getByRole("link", { name: "Feed" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("link", { name: "Notifications" }),
    ).not.toHaveAttribute("aria-current");

    getBoundingClientRect.mockRestore();
  });
});

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

function renderNav() {
  return render(
    <MemoryRouter>
      <FloatingPillNav activeValue="feed" items={items} />
    </MemoryRouter>,
  );
}

function rectangle({ left, width }: { left: number; width: number }): DOMRect {
  return {
    bottom: 40,
    height: 40,
    left,
    right: left + width,
    top: 0,
    width,
    x: left,
    y: 0,
    toJSON: () => ({}),
  };
}
