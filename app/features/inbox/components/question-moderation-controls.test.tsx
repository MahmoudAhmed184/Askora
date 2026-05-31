import { fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";

import { QuestionModerationControls } from "~/features/inbox/components/question-moderation-controls";

describe("QuestionModerationControls", () => {
  it("opens a report dialog with report-plus-block checked by default", () => {
    renderModerationControls();

    fireEvent.click(screen.getByRole("button", { name: /report/i }));

    expect(screen.getByRole("dialog", { name: /report question/i })).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: /also block sender/i }),
    ).toBeChecked();
    expect(
      screen.getByRole("button", { name: /submit report/i }),
    ).toBeInTheDocument();
  });

  it("opens block confirmation instead of submitting immediately", () => {
    renderModerationControls();

    fireEvent.click(screen.getByRole("button", { name: /block sender/i }));

    expect(screen.getByRole("dialog", { name: /block sender/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /confirm block/i }),
    ).toBeInTheDocument();
  });
});

function renderModerationControls() {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: (
          <QuestionModerationControls
            disabled={false}
            questionPublicId="qst_1"
          />
        ),
      },
    ],
    {
      initialEntries: ["/"],
    },
  );

  render(<RouterProvider router={router} />);
}
