import { createRef, type Ref } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  createMemoryRouter,
  RouterProvider,
  type ActionFunction,
} from "react-router";
import { describe, expect, it, vi } from "vitest";

import {
  AnswerEditor,
  type AnswerEditorHandle,
} from "~/features/answers/components/answer-editor/answer-editor";
import type {
  AnswerActionResult,
  AnswerEditorViewData,
} from "~/features/answers/types/answers.types";

describe("AnswerEditor", () => {
  it("identifies the current asker without the oversized workflow header or thread context", () => {
    renderAnswerEditor({
      question: {
        publicId: "qst_1",
        text: "What should I read next?",
        createdAt: "2026-05-31T12:00:00.000Z",
        direction: "ltr",
        sender: {
          username: "asker",
          displayName: "Known Asker",
          avatarUrl: null,
        },
      },
    });

    expect(screen.getByRole("link", { name: "Known Asker" })).toHaveAttribute(
      "href",
      "/asker",
    );
    expect(screen.getByText("@asker")).toBeInTheDocument();
    expect(screen.getByText("Attributed")).toBeInTheDocument();
    expect(screen.queryByText("Prepare response")).not.toBeInTheDocument();
    expect(screen.queryByText("Thread context")).not.toBeInTheDocument();
  });

  it("offers original and hidden wording choices while editing stays on the card", () => {
    renderAnswerEditor();

    expect(
      screen.getByRole("button", {
        name: "Public question wording: Original",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: /edited question/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    openPublicQuestionWordingMenu();

    expect(
      screen.getByRole("menuitemradio", { name: /^original/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitemradio", { name: /^hidden/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("menuitemradio", { name: /^edited/i }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("menuitemradio", { name: /^hidden/i }));

    expect(
      screen.queryByRole("textbox", { name: /edited question/i }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Edit public question wording",
      }),
    );

    expect(
      screen.getByRole("textbox", { name: /edited question/i }),
    ).toBeInTheDocument();
  });

  it("retains typed edited question text across mode changes", () => {
    const { container } = renderAnswerEditor();

    openQuestionEditor();

    const editedField = screen.getByRole("textbox", {
      name: /edited question/i,
    });

    fireEvent.change(editedField, { target: { value: "Cleaned up wording" } });

    choosePublicQuestionWording("Original");

    // Still serialized while hidden, so the draft survives a submit.
    expect(
      container.querySelector('input[name="editedQuestionText"]'),
    ).toHaveValue("Cleaned up wording");

    openQuestionEditor();

    expect(
      screen.getByRole("textbox", { name: /edited question/i }),
    ).toHaveValue("Cleaned up wording");
  });

  it("opens an inline question editor from the card edit icon", () => {
    renderAnswerEditor();

    const editButton = screen.getByRole("button", {
      name: "Edit public question wording",
    });

    expect(editButton).toHaveTextContent("");
    fireEvent.click(editButton);

    expect(
      screen.getByRole("textbox", { name: "Edited question" }),
    ).toHaveValue("What should I read next?");
    expect(
      screen.getByRole("button", {
        name: "Public question wording: Custom wording",
      }),
    ).toBeInTheDocument();
  });

  it("cancels inline editing and restores the previous wording state", () => {
    const { container } = renderAnswerEditor();

    openQuestionEditor();
    fireEvent.change(screen.getByRole("textbox", { name: "Edited question" }), {
      target: { value: "A change that should be discarded" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancel editing" }));

    expect(
      screen.queryByRole("textbox", { name: "Edited question" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Public question wording: Original",
      }),
    ).toBeInTheDocument();
    expect(
      container.querySelector('input[name="editedQuestionText"]'),
    ).toHaveValue("");
  });

  it("changes the follow-up audience from a compact permission menu", () => {
    const { container } = renderAnswerEditor();

    const permissionTrigger = screen.getByRole("button", {
      name: "Follow-ups: Profile default, Anyone",
    });

    expect(permissionTrigger).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(
      container.querySelector('input[name="followUpPermissionOverride"]'),
    ).toHaveValue("");

    fireEvent.pointerDown(permissionTrigger, { button: 0, ctrlKey: false });
    fireEvent.click(
      screen.getByRole("menuitemradio", { name: /original asker only/i }),
    );

    expect(
      screen.getByRole("button", {
        name: "Follow-ups: Original asker only",
      }),
    ).toBeInTheDocument();
    expect(
      container.querySelector('input[name="followUpPermissionOverride"]'),
    ).toHaveValue("original_asker");
  });

  it("autosaves a non-empty answer on blur and leaves publish as the only footer action", async () => {
    let submittedFormData: FormData | undefined;
    const action = vi.fn<ActionFunction>(async ({ request }) => {
      submittedFormData = await request.formData();
      return createDraftSavedActionData();
    });
    renderAnswerEditor({}, { action });

    const answer = screen.getByRole("textbox", { name: "Answer" });
    fireEvent.change(answer, { target: { value: "Save this automatically" } });
    fireEvent.blur(answer);

    await waitFor(() => {
      expect(action).toHaveBeenCalledOnce();
    });
    expect(submittedFormData?.get("intent")).toBe("save_draft");
    expect(submittedFormData?.get("answerText")).toBe(
      "Save this automatically",
    );
    expect(
      screen.queryByRole("button", { name: "Save draft" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Report" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Block sender" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Publish answer" }),
    ).toBeInTheDocument();
  });

  it("autosaves a non-empty answer before the popup closes", async () => {
    const editorRef = createRef<AnswerEditorHandle>();
    const onDraftSavedBeforeClose = vi.fn();
    const action = vi.fn<ActionFunction>(() =>
      Promise.resolve(createDraftSavedActionData()),
    );
    renderAnswerEditor({}, { action, editorRef, onDraftSavedBeforeClose });

    fireEvent.change(screen.getByRole("textbox", { name: "Answer" }), {
      target: { value: "Save before closing" },
    });

    expect(editorRef.current?.saveDraftBeforeClose()).toBe(true);

    await waitFor(() => {
      expect(onDraftSavedBeforeClose).toHaveBeenCalledOnce();
    });
  });
});

function renderAnswerEditor(
  overrides: Partial<AnswerEditorViewData> = {},
  options: {
    action?: ActionFunction | undefined;
    editorRef?: Ref<AnswerEditorHandle> | undefined;
    onDraftSavedBeforeClose?: (() => void) | undefined;
  } = {},
) {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        ...(options.action === undefined ? {} : { action: options.action }),
        element: (
          <AnswerEditor
            actionResult={undefined}
            disabled={false}
            editor={{ ...createEditor(), ...overrides }}
            onDraftSavedBeforeClose={options.onDraftSavedBeforeClose}
            ref={options.editorRef}
          />
        ),
      },
    ],
    { initialEntries: ["/"] },
  );

  return render(<RouterProvider router={router} />);
}

function createDraftSavedActionData(): { answer: AnswerActionResult } {
  return {
    answer: {
      status: "draft_saved",
      questionPublicId: "qst_1",
    },
  };
}

function choosePublicQuestionWording(optionName: string) {
  openPublicQuestionWordingMenu();
  fireEvent.click(
    screen.getByRole("menuitemradio", {
      name: new RegExp(`^${optionName}`, "i"),
    }),
  );
}

function openPublicQuestionWordingMenu() {
  fireEvent.pointerDown(
    screen.getByRole("button", { name: /public question wording:/i }),
    { button: 0, ctrlKey: false },
  );
}

function openQuestionEditor() {
  fireEvent.click(
    screen.getByRole("button", { name: "Edit public question wording" }),
  );
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
      direction: "ltr",
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
