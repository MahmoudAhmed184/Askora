import { fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";

import {
  QuestionModerationControls,
  QuestionModerationNoScriptFallback,
} from "~/features/inbox/components/question-moderation-controls";

describe("QuestionModerationControls", () => {
  it("opens a report dialog with report-plus-block checked by default", async () => {
    renderModerationControls();

    openActionsMenu();
    fireEvent.click(await screen.findByRole("menuitem", { name: /report/i }));

    expect(screen.getByRole("dialog", { name: /report question/i })).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: /also block sender/i }),
    ).toBeChecked();
    expect(
      screen.getByRole("button", { name: /submit report/i }),
    ).toBeInTheDocument();
  });

  it("opens block confirmation instead of submitting immediately", async () => {
    renderModerationControls();

    openActionsMenu();
    fireEvent.click(
      await screen.findByRole("menuitem", { name: /block sender/i }),
    );

    expect(screen.getByRole("dialog", { name: /block sender/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /confirm block/i }),
    ).toBeInTheDocument();
  });

  it("can expose report and block as inline actions", () => {
    renderModerationControls({ variant: "inline" });

    expect(
      screen.queryByRole("button", { name: /question actions/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Report" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /block sender/i }));

    expect(screen.getByRole("dialog", { name: /block sender/i })).toBeInTheDocument();
  });

  it("server-renders complete report and block forms for no-JavaScript clients", () => {
    const markup = renderToStaticMarkup(
      <QuestionModerationNoScriptFallback
        action="/inbox"
        disabled={false}
        questionPublicId="qst_1"
      />,
    );

    expect(markup).toMatch(/<form[^>]+action="\/inbox" method="post">/);
    expect(markup).toContain('type="hidden" name="intent" value="report"');
    expect(markup).toContain('type="hidden" name="intent" value="block"');
    expect(markup).toMatch(/<select[^>]+name="reason" required="">/);
    expect(markup).toContain('name="alsoBlockSender"');
  });
});

function renderModerationControls({
  variant = "menu",
}: {
  variant?: "menu" | "inline";
} = {}) {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: (
          <QuestionModerationControls
            disabled={false}
            questionPublicId="qst_1"
            variant={variant}
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

function openActionsMenu() {
  fireEvent.pointerDown(
    screen.getByRole("button", { name: /question actions/i }),
    {
      button: 0,
      ctrlKey: false,
    },
  );
}
