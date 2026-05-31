import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";

import { SafetySettingsForm } from "~/features/settings/components/safety-settings-form";
import type {
  SafetySettingsSubmissionResult,
  SafetySettingsViewData,
} from "~/features/settings/safety-settings.server";

describe("SafetySettingsForm", () => {
  it("renders muted phrases and creator-safe block rows", () => {
    renderSafetySettingsForm();

    expect(screen.getByText("Spam")).toBeInTheDocument();
    expect(screen.getByText("Asker (@asker)")).toBeInTheDocument();
    expect(screen.getByText("Anonymous account sender")).toBeInTheDocument();
    expect(screen.getByText("Anonymous sender")).toBeInTheDocument();
    expect(screen.queryByText("fingerprint_secret")).not.toBeInTheDocument();
    expect(screen.queryByText("ip_hash_secret")).not.toBeInTheDocument();
    expect(screen.queryByText("user_secret")).not.toBeInTheDocument();
    expect(screen.queryByText("profile_secret")).not.toBeInTheDocument();
  });

  it("shows muted phrase validation messages", () => {
    renderSafetySettingsForm({
      status: "muted_phrase_limit",
      values: {
        intent: "add_muted_phrase",
        acceptingQuestions: true,
        phrase: "one more",
        mutedPhraseId: "",
        blockId: "",
      },
      fieldErrors: {
        phrase: "You can mute up to 50 phrases.",
      },
      formError: "You can mute up to 50 phrases.",
    });

    expect(screen.getAllByText("You can mute up to 50 phrases.")).not.toHaveLength(0);
  });

  it("shows locked copy and disables safety actions", () => {
    renderSafetySettingsForm(undefined, { disabled: true });

    expect(
      screen.getByText(/safety settings are locked while this account is suspended/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save safety/i })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /add muted phrase/i }),
    ).toBeDisabled();
  });
});

const createdAt = "2026-05-31T12:00:00.000Z";

const defaultSettings = {
  acceptingQuestions: true,
  mutedPhrases: [
    {
      id: "phrase_1",
      phrase: "Spam",
      createdAt,
    },
  ],
  blocks: [
    {
      id: "block_account",
      type: "account",
      profile: {
        displayName: "Asker",
        username: "asker",
      },
      createdAt,
    },
    {
      id: "block_account_anonymous",
      type: "account_anonymous",
      createdAt,
      blockedUserId: "user_secret",
    },
    {
      id: "block_anonymous",
      type: "anonymous_signal",
      createdAt,
      safetyFingerprintHash: "fingerprint_secret",
      ipHash: "ip_hash_secret",
      blockedProfileId: "profile_secret",
    },
  ],
} as SafetySettingsViewData;

function renderSafetySettingsForm(
  result?: SafetySettingsSubmissionResult,
  options: {
    disabled?: boolean;
    settings?: SafetySettingsViewData;
  } = {},
) {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: (
          <SafetySettingsForm
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
