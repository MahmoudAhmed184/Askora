import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";

import { ProfileSettingsForm } from "~/features/settings/components/profile-settings-form";
import type {
  ProfileSettingsSubmissionResult,
  ProfileSettingsViewData,
} from "~/features/settings/services/profile-settings.service.server";

describe("ProfileSettingsForm", () => {
  it("shows server validation messages", () => {
    renderProfileSettingsForm({
      status: "invalid",
      values: defaultSettings.values,
      fieldErrors: {
        displayName: "Enter a display name.",
      },
    });

    expect(screen.getByText("Enter a display name.")).toBeInTheDocument();
  });

  it("shows cooldown and locked copy", () => {
    renderProfileSettingsForm(undefined, {
      disabled: true,
      settings: {
        ...defaultSettings,
        usernameCooldown: {
          lastChangedAt: "2026-05-15T12:00:00.000Z",
          nextChangeAt: "2026-06-14T12:00:00.000Z",
          nextChangeDate: "2026-06-14",
          isActive: true,
        },
      },
    });

    expect(
      screen.getByText(/profile settings are locked while this account is suspended/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/username changes reopen on 2026-06-14/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save profile/i })).toBeDisabled();
  });
});

const defaultSettings = {
  values: {
    username: "person",
    displayName: "Person",
    bio: "",
    avatarSource: "fallback",
  },
  googleAvatarUrl: undefined,
  currentAvatarUrl: null,
  usernameCooldown: undefined,
  redirectReservationDays: 90,
} satisfies ProfileSettingsViewData;

function renderProfileSettingsForm(
  result?: ProfileSettingsSubmissionResult,
  options: {
    disabled?: boolean;
    settings?: ProfileSettingsViewData;
  } = {},
) {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: (
          <ProfileSettingsForm
            disabled={options.disabled ?? false}
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
