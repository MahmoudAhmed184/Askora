import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";

import { NotificationList } from "~/features/notifications/components/notification-list";
import type { NotificationView } from "~/features/notifications/notification.server";

describe("NotificationList", () => {
  it("renders safe labels and links without private notification target text", () => {
    renderNotificationList({
      notifications: [
        {
          ...createNotificationView(),
          questionText: "Secret private question",
          answerText: "Secret private answer",
          ipHash: "ip_hash_secret",
        } as unknown as NotificationView,
      ],
    });

    expect(screen.getByText("Your answer got a new like.")).toBeInTheDocument();
    expect(screen.getByText("Liker @liker")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /liker @liker/i })).toHaveAttribute(
      "href",
      "/liker",
    );
    expect(screen.getByRole("button", { name: "Mark read" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open thread" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Secret private question")).not.toBeInTheDocument();
    expect(screen.queryByText("Secret private answer")).not.toBeInTheDocument();
    expect(screen.queryByText("ip_hash_secret")).not.toBeInTheDocument();
  });

  it("renders generic mark-read actions when no safe target exists", () => {
    renderNotificationList({
      notifications: [
        createNotificationView({
          actor: undefined,
          targetHref: undefined,
          type: "follow_up_asked",
          message: "You received a follow-up.",
        }),
      ],
    });

    expect(screen.getByText("You received a follow-up.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark read" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /liker/i })).not.toBeInTheDocument();
  });
});

function renderNotificationList({
  notifications,
}: {
  notifications: NotificationView[];
}) {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: <NotificationList notifications={notifications} />,
      },
    ],
    {
      initialEntries: ["/"],
    },
  );

  render(<RouterProvider router={router} />);
}

function createNotificationView(
  overrides: Partial<NotificationView> = {},
): NotificationView {
  return {
    id: "notification_1",
    type: "answer_liked",
    message: "Your answer got a new like.",
    createdAt: "2026-05-31T12:00:00.000Z",
    readAt: null,
    actor: {
      displayName: "Liker",
      username: "liker",
      avatarUrl: null,
      href: "/liker",
    },
    targetHref: "/person/a/thread_public_1#item-item_public_1",
    ...overrides,
  };
}
