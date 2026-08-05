import { fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { QuestionGenerationSettingsForm } from "~/features/settings/components/question-generation-settings-form";
import type {
  QuestionGenerationSettingsFormValues,
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
});

function renderSettingsForm() {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: (
          <QuestionGenerationSettingsForm
            disabled={false}
            result={undefined}
            settings={defaultSettings}
          />
        ),
      },
    ],
    { initialEntries: ["/"] },
  );

  render(<RouterProvider router={router} />);
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
