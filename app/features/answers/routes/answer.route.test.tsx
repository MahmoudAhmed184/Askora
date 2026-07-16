import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentType } from "react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";

import AnswerRoute from "~/features/answers/routes/answer.route";
import type { AnswerEditorViewData } from "~/features/answers/types/answers.types";

interface AnswerRouteProps {
  loaderData: {
    closeHref: string;
    status: "found";
    editor: AnswerEditorViewData;
    isSuspended: boolean;
  };
}

const AnswerRouteForTest = AnswerRoute as ComponentType<AnswerRouteProps>;

describe("AnswerRoute", () => {
  it("closes the modal with Escape while retaining accessible dialog semantics", async () => {
    const router = createMemoryRouter(
      [
        {
          path: "/answer/qst_1",
          element: (
            <AnswerRouteForTest
              loaderData={{
                closeHref: "/inbox",
                status: "found",
                editor: createEditor(),
                isSuspended: false,
              }}
            />
          ),
        },
        { path: "/inbox", element: <p>Inbox</p> },
      ],
      { initialEntries: ["/answer/qst_1"] },
    );

    render(<RouterProvider router={router} />);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(
      screen.queryByRole("button", { name: "Close answer editor" }),
    ).not.toBeInTheDocument();

    fireEvent.keyDown(dialog, { key: "Escape" });

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/inbox");
    });
  });
});

function createEditor(): AnswerEditorViewData {
  return {
    profile: {
      username: "person",
      displayName: "Person",
    },
    question: {
      publicId: "qst_1",
      text: "What should I read next?",
      identity: "anonymous",
      createdAt: "2026-05-31T12:00:00.000Z",
    },
    values: {
      intent: "unknown",
      answerText: "",
      questionTextMode: "original",
      editedQuestionText: "",
      followUpPermissionOverride: null,
    },
    followUpPermissionDefault: "anyone",
    threadContext: undefined,
  };
}
