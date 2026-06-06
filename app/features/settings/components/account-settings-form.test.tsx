import { fireEvent, render, screen, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";

import { AccountSettingsForm } from "~/features/settings/components/account-settings-form";
import type {
  AccountSettingsSubmissionResult,
  AccountSettingsViewData,
} from "~/features/settings/account-settings.server";

describe("AccountSettingsForm", () => {
  it("requires typed confirmations before enabling destructive actions", () => {
    renderAccountSettingsForm();

    const deactivateButton = screen.getByRole("button", {
      name: /deactivate profile/i,
    });
    const deleteButton = screen.getByRole("button", {
      name: /request account deletion/i,
    });

    expect(deactivateButton).toBeDisabled();
    expect(deleteButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/type deactivate/i), {
      target: { value: "DEACTIVATE" },
    });
    fireEvent.change(screen.getByLabelText(/type delete/i), {
      target: { value: "DELETE" },
    });

    expect(deactivateButton).toBeEnabled();
    expect(deleteButton).toBeEnabled();
  });

  it("shows confirmation errors for the submitted destructive action", () => {
    renderAccountSettingsForm({
      status: "invalid",
      values: {
        intent: "request_deletion",
        confirmation: "delete",
      },
      fieldErrors: {
        confirmation: "Type DELETE to request account deletion.",
      },
      formError: "Check the account action confirmation and try again.",
    });

    expect(
      screen.getByText("Type DELETE to request account deletion."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Type DEACTIVATE to deactivate your profile."),
    ).not.toBeInTheDocument();
  });

  it("opens a confirmation dialog before requesting account deletion", () => {
    renderAccountSettingsForm();

    fireEvent.change(screen.getByLabelText(/type delete/i), {
      target: { value: "DELETE" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /request account deletion/i }),
    );

    const dialog = screen.getByRole("alertdialog", {
      name: "Request account deletion?",
    });

    expect(
      within(dialog).getByText(/your profile will hide immediately/i),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", {
        name: /request account deletion/i,
      }),
    ).toBeEnabled();
  });

  it("shows inline confirmation errors before opening a severe confirmation", () => {
    renderAccountSettingsForm();

    fireEvent.submit(
      screen.getByRole("form", { name: /request account deletion/i }),
    );

    expect(
      screen.getByText("Type DELETE to request account deletion."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("shows pending deletion UI without auto-reactivation controls", () => {
    renderAccountSettingsForm(undefined, {
      settings: {
        ...defaultSettings,
        profile: {
          ...defaultSettings.profile,
          isActive: false,
          deactivatedAt: "2026-05-31T12:00:00.000Z",
          deactivationReason: "account_deletion",
        },
        deletion: {
          status: "pending",
          requestedAt: "2026-05-31T12:00:00.000Z",
          graceEndsAt: "2026-06-14T12:00:00.000Z",
          graceEndsDate: "2026-06-14",
        },
      },
    });

    expect(screen.getByText("Deletion requested")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /cancel deletion request/i }),
    ).toBeEnabled();
    expect(
      screen.getByText(/your profile stays hidden until you explicitly reactivate it/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /reactivate profile/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /request account deletion/i }),
    ).not.toBeInTheDocument();
  });
});

const defaultSettings = {
  user: {
    email: "person@example.com",
    name: "Person",
  },
  profile: {
    username: "person",
    displayName: "Person",
    isActive: true,
    deactivatedAt: null,
    deactivationReason: null,
  },
  deletion: {
    status: "none",
  },
  deletionGraceDays: 14,
} satisfies AccountSettingsViewData;

function renderAccountSettingsForm(
  result?: AccountSettingsSubmissionResult,
  options: {
    isSuspended?: boolean;
    settings?: AccountSettingsViewData;
  } = {},
) {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: (
          <AccountSettingsForm
            isSuspended={options.isSuspended ?? false}
            result={result}
            settings={options.settings ?? defaultSettings}
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
