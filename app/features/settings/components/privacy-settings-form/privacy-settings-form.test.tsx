import { fireEvent, render, screen } from "@testing-library/react";
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

    expect(
      screen.getByText("Choose who can ask questions."),
    ).toBeInTheDocument();
  });

  it("shows locked copy", () => {
    renderPrivacySettingsForm(undefined, { disabled: true });

    expect(
      screen.getByText(
        /privacy settings are locked while this account is suspended/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /save privacy/i }),
    ).toBeDisabled();
  });

  it("renders every privacy toggle as a switch reflecting saved state", () => {
    renderPrivacySettingsForm(undefined, {
      settings: { ...defaultSettings, showLikeCounts: false },
    });

    expect(
      screen.getByRole("switch", { name: "Anonymous questions" }),
    ).toBeChecked();
    expect(
      screen.getByRole("switch", { name: "Follower and following counts" }),
    ).toBeChecked();
    expect(
      screen.getByRole("switch", { name: "Reaction counts" }),
    ).not.toBeChecked();
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });

  it("submits true/false for each switch", () => {
    const { form } = renderPrivacySettingsForm();

    expect(new FormData(form).get("showLikeCounts")).toBe("true");

    fireEvent.click(screen.getByRole("switch", { name: "Reaction counts" }));

    expect(
      screen.getByRole("switch", { name: "Reaction counts" }),
    ).not.toBeChecked();
    expect(new FormData(form).get("showLikeCounts")).toBe("false");
  });

  it("disables the switches while the account is suspended", () => {
    renderPrivacySettingsForm(undefined, { disabled: true });

    for (const name of [
      "Anonymous questions",
      "Follower and following counts",
      "Reaction counts",
    ]) {
      expect(screen.getByRole("switch", { name })).toBeDisabled();
    }
  });

  it("keeps each switch described by its help text", () => {
    renderPrivacySettingsForm();

    const control = screen.getByRole("switch", { name: "Anonymous questions" });
    const describedBy = control.getAttribute("aria-describedby") ?? "";

    expect(document.getElementById(describedBy)).toHaveTextContent(
      /allow visitors to ask without showing a public identity/i,
    );
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

  const { container } = render(<RouterProvider router={router} />);

  return {
    form: getForm(container),
  };
}

function getForm(container: HTMLElement, selector = "form") {
  const form = container.querySelector(selector);

  if (!(form instanceof HTMLFormElement)) {
    throw new Error(`expected a form matching ${selector}`);
  }

  return form;
}
