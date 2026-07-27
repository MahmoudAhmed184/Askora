import { fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeAll, describe, expect, it } from "vitest";

import { PublicThread } from "~/features/threads/components/public-thread";
import type { PublicThreadPageData } from "~/features/threads/queries/public-thread.queries.server";

describe("PublicThread", () => {
  beforeAll(() => {
    globalThis.IntersectionObserver = class IntersectionObserver {
      disconnect() {
        return undefined;
      }

      observe() {
        return undefined;
      }

      takeRecords() {
        return [];
      }

      unobserve() {
        return undefined;
      }
    } as unknown as typeof IntersectionObserver;
  });

  it("renders answers as escaped plain text with preserved line breaks", () => {
    const { container } = renderPublicThread(
      createAvailablePage({
        items: [
          createAnswerItem({
            answerText: "First line\n<script>alert('x')</script>",
          }),
        ],
      }),
    );

    expect(screen.getByText(/First line/)).toHaveClass(
      "whitespace-pre-wrap",
      "break-words",
    );
    expect(screen.getByText(/<script>alert/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /like answer \(0\)/i }),
    ).toBeDisabled();
    expect(
      screen.getAllByRole("link", { name: "Person" }).length,
    ).toBeGreaterThan(0);
    expect(container.querySelector("script")).toBeNull();
  });

  it("renders stable anchors for answer items", () => {
    const { container } = renderPublicThread(
      createAvailablePage({
        items: [createAnswerItem({ publicId: "titem_anchor" })],
      }),
    );

    expect(container.querySelector("#item-titem_anchor")).toBeInTheDocument();
  });

  it("renders follow-up CTA and disabled states", () => {
    const allowedRender = renderPublicThread(createAvailablePage());

    expect(
      screen.getByRole("link", { name: /ask a follow-up/i }),
    ).toHaveAttribute("href", "/person/a/thr_1/follow-ups");

    allowedRender.unmount();

    renderPublicThread(
      createAvailablePage({
        followUp: {
          status: "denied",
          reason: "thread_full",
          message:
            "This thread already has the maximum number of published answers.",
        },
      }),
    );

    expect(screen.getByText("Follow-ups unavailable")).toBeInTheDocument();
    expect(
      screen.getByText(
        "This thread already has the maximum number of published answers.",
      ),
    ).toBeInTheDocument();
  });

  it("renders removed markers without removed answer text", () => {
    renderPublicThread(
      createAvailablePage({
        items: [
          createAnswerItem({ publicId: "titem_1" }),
          { type: "removed", position: 1 },
          createAnswerItem({
            answerText: "Later answer",
            publicId: "titem_3",
          }),
        ],
      }),
    );

    expect(screen.getByText("Answer removed")).toBeInTheDocument();
    expect(
      screen.queryByText("Removed private answer"),
    ).not.toBeInTheDocument();
  });

  it("does not render hidden question text", () => {
    renderPublicThread(
      createAvailablePage({
        items: [
          {
            type: "answer",
            publicId: "titem_hidden",
            answerText: "Answer without the private prompt",
            publishedAt: "2026-05-31T12:00:00.000Z",
            pinPosition: null,
            like: createLikeState("titem_hidden"),
          },
        ],
      }),
    );

    expect(
      screen.getByText("Answer without the private prompt"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Secret hidden question"),
    ).not.toBeInTheDocument();
  });

  it("renders owner controls only when management is allowed", () => {
    const ownerRender = renderPublicThread(
      createAvailablePage({
        publishedAnswerControls: { canManage: true, disabled: false },
      }),
    );

    openPublishedAnswerMenu();

    expect(
      screen.getByRole("menuitem", { name: "Edit silently" }),
    ).toBeEnabled();
    expect(screen.getByRole("menuitem", { name: "Pin" })).toBeEnabled();
    expect(screen.getByRole("menuitem", { name: "Unpublish" })).toBeEnabled();
    expect(screen.getByRole("menuitem", { name: "Delete" })).toBeEnabled();

    ownerRender.unmount();

    renderPublicThread(
      createAvailablePage({
        publishedAnswerControls: { canManage: false, disabled: false },
      }),
    );

    expect(
      screen.queryByRole("button", { name: /manage published answer/i }),
    ).not.toBeInTheDocument();
  });

  it("renders generic unavailable state", () => {
    renderPublicThread({
      status: "unavailable",
      username: "person",
      threadPublicId: "thr_1",
    });

    expect(screen.getByText("@person")).toBeInTheDocument();
    expect(screen.getByText("This thread is unavailable")).toBeInTheDocument();
  });

  it("renders an app-shell thread visit as a full page", () => {
    renderPublicThread(createAvailablePage(), {
      session: {
        profile: {
          username: "person",
          displayName: "Person",
        },
      },
      profileHref: "/person",
      unreadNotificationCount: 0,
    });

    expect(
      screen.getByRole("heading", { name: "1 answer" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /ask a follow-up/i }),
    ).toHaveAttribute("href", "/person/a/thr_1/follow-ups");
    expect(
      screen.queryByRole("link", { name: "Dismiss thread" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("labels each timeline entry and attributes the asker", () => {
    renderPublicThread(
      createAvailablePage({
        items: [
          createAnswerItem({
            asker: {
              displayName: "Asker",
              username: "asker",
              avatarUrl: null,
            },
          }),
        ],
      }),
    );

    expect(screen.getByText("Question")).toBeInTheDocument();
    expect(screen.getByText("Answer")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Asker @asker" })).toHaveAttribute(
      "href",
      "/asker",
    );
  });

  it("attributes anonymous askers without exposing an account", () => {
    renderPublicThread(createAvailablePage());

    expect(screen.getByText("Anonymous")).toBeInTheDocument();
  });

  it("discloses edited question wording", () => {
    const edited = renderPublicThread(
      createAvailablePage({
        items: [createAnswerItem({ questionTextMode: "edited" })],
      }),
    );

    expect(screen.getByText("Edited question")).toBeInTheDocument();

    edited.unmount();

    renderPublicThread(
      createAvailablePage({
        items: [createAnswerItem({ questionTextMode: "original" })],
      }),
    );

    expect(screen.queryByText("Edited question")).not.toBeInTheDocument();
  });

  it("counts answers semantically", () => {
    const single = renderPublicThread(createAvailablePage());

    expect(
      screen.getByRole("heading", { name: "1 answer" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("1 item")).not.toBeInTheDocument();

    single.unmount();

    renderPublicThread(
      createAvailablePage({
        items: [
          createAnswerItem({ publicId: "titem_1" }),
          createAnswerItem({ publicId: "titem_2" }),
        ],
      }),
    );

    expect(
      screen.getByRole("heading", { name: "2 answers" }),
    ).toBeInTheDocument();
  });

  it("links the thread owner identity to their profile", () => {
    renderPublicThread(createAvailablePage());

    for (const link of screen.getAllByRole("link", { name: "Person" })) {
      expect(link).toHaveAttribute("href", "/person");
    }
  });
});

function renderPublicThread(
  page: PublicThreadPageData,
  shell?: {
    session: {
      profile: {
        username: string;
        displayName: string;
      };
    };
    profileHref: string;
    unreadNotificationCount: number;
  },
) {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: <PublicThread betaNoindex={false} page={page} shell={shell} />,
      },
    ],
    {
      initialEntries: ["/"],
    },
  );

  return render(<RouterProvider router={router} />);
}

function openPublishedAnswerMenu() {
  fireEvent.pointerDown(
    screen.getByRole("button", { name: /manage published answer/i }),
  );
}

function createAvailablePage(
  overrides: Partial<
    Extract<PublicThreadPageData, { status: "available" }>
  > = {},
): Extract<PublicThreadPageData, { status: "available" }> {
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
    items: [createAnswerItem()],
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
    ...overrides,
  };
}

function createAnswerItem(
  overrides: Partial<
    Extract<
      Extract<PublicThreadPageData, { status: "available" }>["items"][number],
      { type: "answer" }
    >
  > = {},
): Extract<
  Extract<PublicThreadPageData, { status: "available" }>["items"][number],
  { type: "answer" }
> {
  return {
    type: "answer",
    publicId: "titem_1",
    answerText: "Published answer",
    publishedAt: "2026-05-31T12:00:00.000Z",
    pinPosition: null,
    like: createLikeState(overrides.publicId ?? "titem_1"),
    questionText: "What should I read next?",
    ...overrides,
  };
}

function createLikeState(threadItemPublicId: string) {
  return {
    threadItemPublicId,
    isLiked: false,
    count: 0,
    disabled: true,
  };
}
