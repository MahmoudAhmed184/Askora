import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FollowButton } from "~/features/social/components/follow-button";
import { LikeButton } from "~/features/social/components/like-button";
import type {
  FollowControlState,
  LikeControlState,
} from "~/features/social/social-controls";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

describe("social controls", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("toasts when an answer is liked", async () => {
    renderWithRouter(<LikeButton like={likeControl} />, {
      like: {
        status: "liked",
        threadItemPublicId: likeControl.threadItemPublicId,
        redirectTo: "/dashboard/feed",
        notificationCreated: false,
      },
    });

    fireEvent.click(screen.getByRole("button", { name: /like answer/i }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Reaction added.", {
        id: "action-toast:success:Reaction added.:",
      });
    });
  });

  it("toasts when a profile is followed", async () => {
    renderWithRouter(<FollowButton follow={followControl} />, {
      follow: {
        status: "followed",
        username: followControl.username,
        redirectTo: "/dashboard/feed",
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "Follow" }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Profile followed.", {
        id: "action-toast:success:Profile followed.:",
      });
    });
  });
});

const likeControl = {
  threadItemPublicId: "thread_item_1",
  isLiked: false,
  count: 2,
  disabled: false,
} satisfies LikeControlState;

const followControl = {
  visible: true,
  username: "maya",
  isFollowing: false,
  disabled: false,
} satisfies FollowControlState;

function renderWithRouter(
  element: ReactNode,
  actionData: {
    like?: unknown;
    follow?: unknown;
  },
) {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element,
      },
      {
        path: "/dashboard/likes",
        action() {
          return actionData;
        },
      },
      {
        path: "/dashboard/follows",
        action() {
          return actionData;
        },
      },
    ],
    {
      initialEntries: ["/"],
    },
  );

  render(<RouterProvider router={router} />);
}
