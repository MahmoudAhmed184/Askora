import { fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";

import { PublicReportDialog } from "~/features/moderation/components/public-report-dialog";

describe("PublicReportDialog", () => {
  it("does not expose reporting controls when the viewer cannot report", () => {
    renderDialog({ canReport: false });

    expect(screen.queryByRole("button", { name: /report answer/i })).not.toBeInTheDocument();
  });

  it("opens an accessible report form for an answer", () => {
    renderDialog({ canReport: true });

    fireEvent.click(screen.getByRole("button", { name: "Report answer" }));

    expect(screen.getByRole("dialog", { name: "Report answer" })).toBeInTheDocument();
    expect(screen.getByLabelText("Reason")).toHaveAttribute("name", "reason");
    expect(screen.getByLabelText("Details")).toHaveAttribute("maxLength", "500");
    expect(screen.getByDisplayValue("thread_item")).toHaveAttribute(
      "name",
      "targetType",
    );
    expect(screen.getByDisplayValue("answer_1")).toHaveAttribute(
      "name",
      "targetId",
    );
  });
});

function renderDialog({ canReport }: { canReport: boolean }) {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: (
          <PublicReportDialog
            canReport={canReport}
            targetId="answer_1"
            targetLabel="answer"
            targetType="thread_item"
          />
        ),
      },
    ],
    { initialEntries: ["/"] },
  );

  return render(<RouterProvider router={router} />);
}
