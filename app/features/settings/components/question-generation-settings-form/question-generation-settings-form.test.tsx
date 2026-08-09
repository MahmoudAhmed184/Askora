import { fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { QuestionGenerationSettingsForm } from "~/features/settings/components/question-generation-settings-form";
import type {
  QuestionGenerationSettingsFormValues,
  QuestionGenerationSettingsSubmissionResult,
  QuestionGenerationSettingsViewData,
} from "~/features/question-generation/question-generation-settings.service.server";

describe("QuestionGenerationSettingsForm", () => {
  it("uses a masked credential field and does not render stored credential material", () => {
    renderSettingsForm();

    const apiKey = screen.getByLabelText("Gemini API key");

    expect(apiKey).toHaveAttribute("type", "password");
    expect(apiKey).toHaveAttribute("autocomplete", "off");
    expect(screen.queryByText("ciphertext")).not.toBeInTheDocument();
    expect(screen.getByText("Not connected")).toBeInTheDocument();
  });

  it("adds interests with Enter and serializes them as private form values", () => {
    renderSettingsForm();

    const interest = screen.getByLabelText("Question interests");
    fireEvent.change(interest, { target: { value: "Books" } });
    fireEvent.keyDown(interest, { key: "Enter" });

    expect(screen.getByText("Books")).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "Question generation preferences" })).toHaveFormValues({
      questionInterests: "Books",
    });
  });

  it("applies Unicode length and duplicate rules when committing interests", () => {
    renderSettingsForm();

    const interest = screen.getByLabelText("Question interests");
    fireEvent.change(interest, { target: { value: "😀" } });
    fireEvent.keyDown(interest, { key: "Enter" });
    expect(screen.queryByText("😀")).not.toBeInTheDocument();

    fireEvent.change(interest, { target: { value: "موسيقى" } });
    fireEvent.keyDown(interest, { key: "Enter" });
    fireEvent.change(interest, { target: { value: "موسيقى" } });
    fireEvent.blur(interest);

    expect(screen.getAllByText("موسيقى")).toHaveLength(1);
    expect(
      screen.getByRole("form", { name: "Question generation preferences" }),
    ).toHaveFormValues({ questionInterests: "موسيقى" });
  });

  it("serializes a valid typed interest when Save is clicked directly", () => {
    renderSettingsForm();

    const interest = screen.getByLabelText("Question interests");
    fireEvent.change(interest, { target: { value: "Direct save" } });
    fireEvent.click(screen.getByRole("button", { name: "Save preferences" }));

    expect(
      screen.getByRole("form", { name: "Question generation preferences" }),
    ).toHaveFormValues({ questionInterests: "Direct save" });
  });

  it("keeps a legal unbroken interest and its remove action within the chip", () => {
    const unbrokenInterest = "x".repeat(40);
    renderSettingsForm({
      settings: {
        ...defaultSettings,
        questionInterests: [unbrokenInterest],
      },
    });

    const label = screen.getByText(unbrokenInterest);
    const chip = label.closest("li");
    expect(chip).toHaveClass("max-w-full", "min-w-0");
    expect(label).toHaveClass("min-w-0", "break-all");
    expect(
      screen.getByRole("button", { name: `Remove ${unbrokenInterest}` }),
    ).toHaveClass("shrink-0");
  });

  it("exposes an accessible disclosure acknowledgement", () => {
    renderSettingsForm();

    expect(screen.getByRole("checkbox")).toHaveAttribute(
      "name",
      "acknowledgeDisclosure",
    );
    expect(screen.getByRole("form", { name: "Acknowledge data use" })).toBeInTheDocument();
  });

  it("offers Gemini 3.5 Flash-Lite instead of the retired 3.1 option", () => {
    renderSettingsForm();

    fireEvent.click(screen.getByRole("combobox", { name: "Active model" }));

    expect(
      screen.getByRole("option", { name: "Gemini 3.5 Flash-Lite" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Gemini 3.1 Flash-Lite" }),
    ).not.toBeInTheDocument();
  });

  it("clears the credential after each completed submission", () => {
    function Harness() {
      const [submission, setSubmission] = useState(0);

      return (
        <>
          <button
            onClick={() => {
              setSubmission((current) => current + 1);
            }}
            type="button"
          >
            Complete submission
          </button>
          <QuestionGenerationSettingsForm
            disabled={false}
            result={
              submission === 0
                ? undefined
                : submission === 1
                  ? { status: "credential_replaced", values: formValues }
                  : {
                      status: "credential_invalid",
                      values: formValues,
                      formError: "Gemini could not validate this key.",
                    }
            }
            settings={defaultSettings}
          />
        </>
      );
    }

    const router = createMemoryRouter(
      [{ path: "/", element: <Harness /> }],
      { initialEntries: ["/"] },
    );
    render(<RouterProvider router={router} />);

    const apiKey = screen.getByLabelText("Gemini API key");
    fireEvent.change(apiKey, { target: { value: "first-secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Complete submission" }));
    expect(apiKey).toHaveValue("");

    fireEvent.change(apiKey, { target: { value: "second-secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Complete submission" }));
    expect(apiKey).toHaveValue("");
  });

  it("keeps loader-backed preferences for a failed non-preference POST", () => {
    const outcomes: QuestionGenerationSettingsSubmissionResult[] = [
      {
        status: "invalid",
        values: formValues,
        fieldErrors: { geminiApiKey: "Enter a key." },
        formError: "Check the question-generation settings and try again.",
      },
      { status: "credential_connected", values: formValues },
      { status: "credential_disconnected", values: formValues },
      { status: "disclosure_acknowledged", values: formValues },
    ];

    for (const result of outcomes) {
      const view = renderSettingsForm({
        result,
        settings: {
          ...defaultSettings,
          modelPreference: "gemini-3.5-flash-lite",
          questionInterests: ["Books", "Arabic literature"],
        },
      });

      expect(screen.getByRole("combobox", { name: "Active model" })).toHaveTextContent(
        "Gemini 3.5 Flash-Lite",
      );
      expect(screen.getByText("Books")).toBeInTheDocument();
      expect(screen.getByText("Arabic literature")).toBeInTheDocument();
      view.unmount();
    }
  });

  it("keeps credential deletion available while the owner is suspended", () => {
    renderSettingsForm({
      disabled: true,
      settings: { ...defaultSettings, connected: true },
    });

    expect(
      screen.getByRole("button", { name: "Disconnect Gemini" }),
    ).toBeEnabled();
    expect(screen.getByRole("button", { name: "Replace key" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Save preferences" }),
    ).toBeDisabled();
  });

  it("shows the rate-limit retry time in visible and live feedback", () => {
    renderSettingsForm({
      result: {
        status: "rate_limited",
        values: formValues,
        formError: "Too many key checks. Try again later.",
        retryAfterSeconds: 75,
      },
    });

    expect(
      screen.getAllByText(/Try again in 2 minutes\./u).length,
    ).toBeGreaterThanOrEqual(1);
  });
});

function renderSettingsForm({
  disabled = false,
  result,
  settings = defaultSettings,
}: {
  disabled?: boolean;
  result?: QuestionGenerationSettingsSubmissionResult;
  settings?: QuestionGenerationSettingsViewData;
} = {}) {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: (
          <QuestionGenerationSettingsForm
            disabled={disabled}
            result={result}
            settings={settings}
          />
        ),
      },
    ],
    { initialEntries: ["/"] },
  );

  return render(<RouterProvider router={router} />);
}

const defaultSettings = {
  connected: false,
  credentialValidatedAt: undefined,
  disclosureAcknowledged: false,
  disclosureVersion: 1,
  modelPreference: "auto",
  questionInterests: [],
} satisfies QuestionGenerationSettingsViewData;

const formValues: QuestionGenerationSettingsFormValues = {
  acknowledgeDisclosure: false,
  intent: "connect",
  modelPreference: "auto",
  questionInterests: [],
};
