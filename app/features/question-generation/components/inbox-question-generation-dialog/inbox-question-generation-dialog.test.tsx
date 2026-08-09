import { fireEvent, render, screen, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";

import { InboxQuestionGenerationDialog } from "~/features/question-generation/components/inbox-question-generation-dialog";

describe("InboxQuestionGenerationDialog", () => {
  it("opens an accessible form with the specified defaults and topic direction", () => {
    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Get Questions" }));

    expect(screen.getByRole("dialog", { name: "Get Questions" })).toBeInTheDocument();
    expect(screen.getByLabelText("What do you want to talk about?")).toHaveAttribute("dir", "auto");
    expect(screen.getByLabelText("Style")).toHaveTextContent("Balanced");
    expect(screen.getByLabelText("Quantity")).toHaveTextContent("5");
    expect(screen.getByRole("form", { name: "Get Questions" })).toHaveFormValues({
      style: "balanced",
      requestedCount: "5",
    });
    expect(screen.getByText("Model: Auto")).toBeInTheDocument();
  });

  it("keeps the trigger available and directs unconfigured owners to settings", () => {
    renderDialog({ connected: false, disclosureAcknowledged: false });

    fireEvent.click(screen.getByRole("button", { name: "Get Questions" }));

    expect(screen.getByRole("link", { name: "Open Question Preferences" })).toHaveAttribute(
      "href",
      "/settings/question-generation",
    );
    expect(screen.queryByRole("form", { name: "Get Questions" })).not.toBeInTheDocument();
  });

  it("provides a visible dismissal control for unconfigured owners", () => {
    renderDialog({ connected: false, disclosureAcknowledged: false });

    fireEvent.click(screen.getByRole("button", { name: "Get Questions" }));
    const dialog = screen.getByRole("dialog", { name: "Get Questions" });
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeVisible();
    expect(dialog).toHaveClass("bottom-0", "rounded-t-3xl");

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog", { name: "Get Questions" })).not.toBeInTheDocument();
  });

  it("shows when a rate-limited owner can try again", async () => {
    const router = createMemoryRouter(
      [
        {
          path: "/",
          element: (
            <InboxQuestionGenerationDialog
              availability={{
                activeModelLabel: "Auto",
                connected: true,
                disclosureAcknowledged: true,
              }}
            />
          ),
          action: () => ({
            generation: {
              status: "failed" as const,
              formError: "Too many generation attempts. Try again later.",
              retryAfterSeconds: 75,
            },
          }),
        },
      ],
      { initialEntries: ["/"] },
    );
    render(<RouterProvider router={router} />);

    fireEvent.click(screen.getByRole("button", { name: "Get Questions" }));
    const dialog = screen.getByRole("dialog", { name: "Get Questions" });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Get Questions" }),
    );

    expect(
      (await screen.findAllByText(/Try again in 2 minutes\./u)).length,
    ).toBeGreaterThanOrEqual(1);
  });
});

function renderDialog({
  activeModelLabel = "Auto",
  connected = true,
  disclosureAcknowledged = true,
}: {
  activeModelLabel?: string;
  connected?: boolean;
  disclosureAcknowledged?: boolean;
} = {}) {
  const router = createMemoryRouter(
    [{ path: "/", element: <InboxQuestionGenerationDialog availability={{ activeModelLabel, connected, disclosureAcknowledged }} /> }],
    { initialEntries: ["/"] },
  );
  render(<RouterProvider router={router} />);
}
