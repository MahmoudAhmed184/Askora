import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";

import { ThreadModalHost } from "~/features/threads/components/thread-modal-host";
import type {
  PublicThreadPageData
} from "~/features/threads/queries/public-thread.queries.server";;

describe("ThreadModalHost", () => {
  it("renders a viewport-inset scrollable modal without a visible close button", () => {
    renderThreadModalHost();

    expect(
      screen.queryByRole("button", { name: "Close thread" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Public thread" })).toHaveClass(
      "block",
      "h-svh",
      "overflow-y-scroll",
      "pb-[calc(6rem+env(safe-area-inset-bottom))]",
      "top-0",
    );
  });
});

function renderThreadModalHost() {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: (
          <ThreadModalHost
            modal={{
              canonicalPath: "/person/a/thr_1",
              page: createAvailablePage(),
            }}
          />
        ),
      },
    ],
    {
      initialEntries: ["/"],
    },
  );

  return render(<RouterProvider router={router} />);
}

function createAvailablePage(): Extract<
  PublicThreadPageData,
  { status: "available" }
> {
  return {
    status: "available",
    profile: {
      username: "person",
      displayName: "Person",
      avatarUrl: null,
    },
    thread: {
      publicId: "thr_1",
      publishedAt: "2026-05-31T12:00:00.000Z",
    },
    items: [
      {
        type: "answer",
        publicId: "titem_1",
        answerText: "Published answer",
        publishedAt: "2026-05-31T12:00:00.000Z",
        pinPosition: null,
        questionText: "What should I read next?",
        like: {
          threadItemPublicId: "titem_1",
          isLiked: false,
          count: 0,
          disabled: true,
        },
      },
    ],
    followUp: {
      status: "allowed",
      defaultIdentity: "anonymous",
      anonymousAllowed: true,
      attributedAllowed: false,
      description: "Your follow-up is anonymous to the recipient and public viewers.",
      effectivePermission: "anyone",
    },
    publishedAnswerControls: {
      canManage: false,
      disabled: false,
    },
    follow: {
      visible: false,
      username: "person",
      isFollowing: false,
      disabled: false,
    },
  };
}
