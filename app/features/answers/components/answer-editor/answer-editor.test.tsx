import { fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";

import { AnswerEditor } from "~/features/answers/components/answer-editor/answer-editor";
import type { AnswerEditorViewData } from "~/features/answers/types/answers.types";

describe("AnswerEditor", () => {
  it("identifies the current asker without the oversized workflow header or thread context", () => {
    renderAnswerEditor({
      question: {
        publicId: "qst_1",
        text: "What should I read next?",
        createdAt: "2026-05-31T12:00:00.000Z",
        sender: {
          username: "asker",
          displayName: "Known Asker",
          avatarUrl: null,
        },
      },
    });

    expect(
      screen.getByRole("link", { name: "Known Asker" }),
    ).toHaveAttribute("href", "/asker");
    expect(screen.getByText("@asker")).toBeInTheDocument();
    expect(screen.getByText("Attributed")).toBeInTheDocument();
    expect(screen.queryByText("Prepare response")).not.toBeInTheDocument();
    expect(screen.queryByText("Thread context")).not.toBeInTheDocument();
  });

  it("hides the edited question field unless Edited mode is selected", () => {
    renderAnswerEditor();

    expect(screen.getByRole("radio", { name: /original/i })).toBeChecked();
    expect(
      screen.queryByRole("textbox", { name: /edited question/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: /hidden/i }));

    expect(
      screen.queryByRole("textbox", { name: /edited question/i }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: /edited/i }));

    expect(
      screen.getByRole("textbox", { name: /edited question/i }),
    ).toBeInTheDocument();
  });

  it("retains typed edited question text across mode changes", () => {
    const { container } = renderAnswerEditor();

    fireEvent.click(screen.getByRole("radio", { name: /edited/i }));

    const editedField = screen.getByRole("textbox", {
      name: /edited question/i,
    });

    fireEvent.change(editedField, { target: { value: "Cleaned up wording" } });

    fireEvent.click(screen.getByRole("radio", { name: /original/i }));

    // Still serialized while hidden, so the draft survives a submit.
    expect(
      container.querySelector('input[name="editedQuestionText"]'),
    ).toHaveValue("Cleaned up wording");

    fireEvent.click(screen.getByRole("radio", { name: /edited/i }));

    expect(
      screen.getByRole("textbox", { name: /edited question/i }),
    ).toHaveValue("Cleaned up wording");
  });
});

function renderAnswerEditor(overrides: Partial<AnswerEditorViewData> = {}) {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: (
          <AnswerEditor
            actionResult={undefined}
            disabled={false}
            editor={{ ...createEditor(), ...overrides }}
          />
        ),
      },
    ],
    { initialEntries: ["/"] },
  );

  return render(<RouterProvider router={router} />);
}

function createEditor(): AnswerEditorViewData {
  return {
    profile: {
      username: "person",
      displayName: "Person",
    },
    question: {
      publicId: "qst_1",
      text: "What should I read next?",
      createdAt: "2026-05-31T12:00:00.000Z",
      sender: undefined,
    },
    values: {
      intent: "unknown",
      answerText: "",
      questionTextMode: "original",
      editedQuestionText: "",
      followUpPermissionOverride: null,
    },
    followUpPermissionDefault: "anyone",
  };
}
