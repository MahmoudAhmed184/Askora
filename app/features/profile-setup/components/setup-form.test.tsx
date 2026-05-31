import { fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";

import { SetupForm } from "~/features/profile-setup/components/setup-form";
import type { ProfileSetupFormResult } from "~/features/profile-setup/profile-setup.server";

describe("SetupForm", () => {
  it("shows local username policy feedback", () => {
    renderSetupForm();

    fireEvent.change(screen.getByLabelText(/username/i), {
      target: { value: "Creator" },
    });

    expect(screen.getByRole("alert")).toHaveTextContent(/lowercase/i);
  });

  it("tracks the bio character count", () => {
    renderSetupForm();

    fireEvent.change(screen.getByLabelText(/bio/i), {
      target: { value: "hello" },
    });

    expect(screen.getByText("5/160")).toBeInTheDocument();
  });

  it("renders server field errors", () => {
    renderSetupForm({
      status: "username_taken",
      values: {
        username: "creator",
        displayName: "Person",
        bio: "",
      },
      fieldErrors: {
        username: "This username is not available.",
      },
    });

    expect(screen.getByText(/not available/i)).toBeInTheDocument();
  });
});

function renderSetupForm(result?: ProfileSetupFormResult) {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: (
          <SetupForm
            defaults={{
              username: "person",
              displayName: "Person",
              bio: "",
            }}
            disabled={false}
            result={result}
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
