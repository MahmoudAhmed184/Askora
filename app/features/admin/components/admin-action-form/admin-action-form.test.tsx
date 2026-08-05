import { fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";

import { AdminActionForm } from "~/features/admin/components/admin-action-form";

describe("AdminActionForm", () => {
  it("opens confirmation before applying severe moderation actions", () => {
    renderAdminActionForm();

    selectAction("Remove public content *");
    fireEvent.change(screen.getByLabelText("Notes"), {
      target: { value: "Published private information." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply action" }));

    expect(
      screen.getByRole("alertdialog", { name: "Remove public content?" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Apply Remove public content" }),
    ).toBeEnabled();
  });

  it("lets dismiss submit without a confirmation dialog", () => {
    renderAdminActionForm();

    fireEvent.click(screen.getByRole("button", { name: "Apply action" }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("shows required notes inline before severe confirmation", () => {
    renderAdminActionForm();

    selectAction("Remove public content *");
    fireEvent.click(screen.getByRole("button", { name: "Apply action" }));

    expect(
      screen.getByText("Notes are required for this action."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});

function selectAction(name: string) {
  fireEvent.click(screen.getByRole("combobox", { name: "Action" }));
  fireEvent.click(screen.getByRole("option", { name }));
}

function renderAdminActionForm() {
  const router = createMemoryRouter([
    {
      action() {
        return null;
      },
      element: (
        <AdminActionForm
          actionResult={undefined}
          availableActions={[
            "dismiss",
            "warn",
            "suspend_7_days",
            "suspend_30_days",
            "permanent_suspension",
            "hide_profile",
            "remove_public_content",
          ]}
        />
      ),
      path: "/",
    },
  ]);

  return render(<RouterProvider router={router} />);
}
