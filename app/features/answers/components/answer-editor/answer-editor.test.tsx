import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";

import { AnswerEditor } from "~/features/answers/components/answer-editor/answer-editor";
import type { AnswerEditorViewData } from "~/features/answers/types/answers.types";

describe("AnswerEditor", () => {
  it("keeps edited question text reachable when original mode is selected", () => {
    const router = createMemoryRouter(
      [
        {
          path: "/",
          element: (
            <AnswerEditor
              actionResult={undefined}
              disabled={false}
              editor={createEditor()}
            />
          ),
        },
      ],
      { initialEntries: ["/"] },
    );

    render(<RouterProvider router={router} />);

    expect(
      screen.getByRole("textbox", { name: /edited question/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /original/i })).toBeChecked();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
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
