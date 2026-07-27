import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";

import { ThreadModalHost } from "~/features/threads/components/thread-modal-host";
import type { PublicThreadPageData } from "~/features/threads/queries/public-thread.queries.server";

describe("ThreadModalHost", () => {
  it("renders a centered card that scrolls internally", () => {
    renderThreadModalHost();

    const dialog = screen.getByRole("dialog", { name: "Public thread" });

    expect(dialog).toHaveClass(
      "max-h-[calc(100svh-2rem)]",
      "max-w-2xl",
      "w-[calc(100vw-1.5rem)]",
    );
    expect(
      dialog.querySelector(".overflow-y-auto.overscroll-contain"),
    ).toBeInTheDocument();
  });

  it("provides an explicit close button", () => {
    renderThreadModalHost();

    expect(
      screen.getByRole("button", { name: "Close thread" }),
    ).toBeInTheDocument();
  });

  it("shows the inline follow-up composer instead of navigating away", () => {
    renderThreadModalHost();

    expect(
      screen.getByRole("textbox", { name: /follow-up/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /send follow-up/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /ask a follow-up/i }),
    ).not.toBeInTheDocument();
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
              followUpComposer: {
                status: "available",
                timingToken: "token",
              },
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
      description:
        "Your follow-up is anonymous to the recipient and public viewers.",
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
    canReport: false,
  };
}
