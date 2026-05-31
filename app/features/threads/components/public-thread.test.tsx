import { fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";

import { PublicThread } from "~/features/threads/components/public-thread";
import type { PublicThreadPageData } from "~/features/threads/public-thread.loader.server";

describe("PublicThread", () => {
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
    expect(screen.queryByText("Removed private answer")).not.toBeInTheDocument();
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
          },
        ],
      }),
    );

    expect(screen.getByText("Answer without the private prompt")).toBeInTheDocument();
    expect(screen.queryByText("Secret hidden question")).not.toBeInTheDocument();
  });

  it("renders owner controls only when management is allowed", () => {
    const ownerRender = renderPublicThread(
      createAvailablePage({
        publishedAnswerControls: { canManage: true, disabled: false },
      }),
    );

    fireEvent.click(screen.getByText("Manage"));

    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Pin" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Unpublish" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Delete" })).toBeEnabled();

    ownerRender.unmount();

    renderPublicThread(
      createAvailablePage({
        publishedAnswerControls: { canManage: false, disabled: false },
      }),
    );

    expect(screen.queryByText("Manage")).not.toBeInTheDocument();
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
});

function renderPublicThread(page: PublicThreadPageData) {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: <PublicThread betaNoindex={false} page={page} />,
      },
    ],
    {
      initialEntries: ["/"],
    },
  );

  return render(<RouterProvider router={router} />);
}

function createAvailablePage(
  overrides: Partial<Extract<PublicThreadPageData, { status: "available" }>> = {},
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
    publishedAnswerControls: {
      canManage: false,
      disabled: false,
    },
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
    questionText: "What should I read next?",
    ...overrides,
  };
}
