import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";

import { PrivacySettingsForm } from "~/features/settings/components/privacy-settings-form";
import type {
  PrivacySettingsFormValues,
  PrivacySettingsSubmissionResult,
} from "~/features/settings/services/privacy-settings.service.server";

describe("PrivacySettingsForm", () => {
  it("shows server validation messages", () => {
    renderPrivacySettingsForm({
      status: "invalid",
      values: defaultSettings,
      fieldErrors: {
        askPermission: "Choose who can ask questions.",
      },
    });

    expect(screen.getByText("Choose who can ask questions.")).toBeInTheDocument();
  });

  it("shows locked copy", () => {
    renderPrivacySettingsForm(undefined, { disabled: true });

    expect(
      screen.getByText(/privacy settings are locked while this account is suspended/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save privacy/i })).toBeDisabled();
  });
});

const defaultSettings = {
  anonymousQuestionsEnabled: true,
  askPermission: "everyone",
  followUpPermissionDefault: "anyone",
  showFollowerCounts: true,
  showLikeCounts: true,
} satisfies PrivacySettingsFormValues;

function renderPrivacySettingsForm(
  result?: PrivacySettingsSubmissionResult,
  options: {
    disabled?: boolean;
    settings?: PrivacySettingsFormValues;
  } = {},
) {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: (
          <PrivacySettingsForm
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
