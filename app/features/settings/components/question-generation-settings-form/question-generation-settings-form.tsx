import { KeyRound, Plus, Save, Sparkles, Trash2 } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Form } from "react-router";

import { ActionToast } from "~/components/shared/action-toast/action-toast";
import { PendingButton } from "~/components/shared/pending-button/pending-button";
import { Badge } from "~/components/ui/badge/badge";
import { Button } from "~/components/ui/button/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "~/components/ui/field/field";
import { Input } from "~/components/ui/input/input";
import { Select } from "~/components/ui/select/select";
import {
  questionGenerationModelPreferenceValues,
  type QuestionGenerationModelPreference,
} from "~/features/question-generation/question-generation.constants";
import type {
  QuestionGenerationSettingsFieldErrors,
  QuestionGenerationSettingsSubmissionResult,
  QuestionGenerationSettingsViewData,
} from "~/features/question-generation/question-generation-settings.service.server";

interface QuestionGenerationSettingsFormProps {
  disabled: boolean;
  result: QuestionGenerationSettingsSubmissionResult | undefined;
  settings: QuestionGenerationSettingsViewData;
}

const modelLabels: Record<QuestionGenerationModelPreference, string> = {
  auto: "Auto",
  "gemini-3.6-flash": "Gemini 3.6 Flash",
  "gemini-3.1-flash-lite": "Gemini 3.1 Flash-Lite",
};

export function QuestionGenerationSettingsForm({
  disabled,
  result,
  settings,
}: QuestionGenerationSettingsFormProps) {
  const initialValues = result?.values;
  const [modelPreference, setModelPreference] =
    useState<QuestionGenerationModelPreference>(
      initialValues?.modelPreference ?? settings.modelPreference,
    );
  const [interests, setInterests] = useState(
    initialValues?.questionInterests ?? settings.questionInterests,
  );
  const [interestInput, setInterestInput] = useState("");
  const apiKeyInputRef = useRef<HTMLInputElement>(null);
  const fieldErrors = getFieldErrors(result);

  useEffect(() => {
    if (result !== undefined) {
      apiKeyInputRef.current?.form?.reset();
    }
  }, [result]);

  function addInterest() {
    const nextInterest = interestInput.trim();

    if (nextInterest.length === 0) {
      return;
    }

    setInterests((current) => [...current, nextInterest]);
    setInterestInput("");
  }

  function handleInterestKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter" && event.key !== ",") {
      return;
    }

    event.preventDefault();
    addInterest();
  }

  return (
    <div className="flex flex-col gap-8 p-5 text-card-foreground sm:p-6">
      <ActionToast
        message={getSettingsToastMessage(result)}
        tone={isSuccess(result) ? "success" : "error"}
        trigger={result}
      />

      <section aria-labelledby="gemini-connection-heading" className="grid gap-4">
        <SectionHeading
          description="Your key stays encrypted on Askora and is never shown again."
          icon={<KeyRound aria-hidden="true" className="mt-1 size-4 shrink-0" />}
          id="gemini-connection-heading"
          title="Gemini connection"
        />
        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-secondary p-3">
          <span className="text-sm font-medium">Status</span>
          <Badge variant={settings.connected ? "secondary" : "outline"}>
            {settings.connected ? "Connected" : "Not connected"}
          </Badge>
        </div>

        <Form aria-label="Connect Gemini" className="grid gap-4" method="post">
          <input name="intent" type="hidden" value="connect" />
          <input name="modelPreference" type="hidden" value={modelPreference} />
          <fieldset className="contents" disabled={disabled}>
            <Field
              data-invalid={fieldErrors.geminiApiKey !== undefined ? true : undefined}
            >
              <FieldLabel htmlFor="geminiApiKey">
                {settings.connected ? "Replace Gemini API key" : "Gemini API key"}
              </FieldLabel>
              <Input
                aria-describedby="geminiApiKey-description geminiApiKey-message"
                aria-invalid={fieldErrors.geminiApiKey !== undefined}
                autoComplete="off"
                id="geminiApiKey"
                name="geminiApiKey"
                placeholder="Paste a Gemini API key"
                spellCheck={false}
                type="password"
                ref={apiKeyInputRef}
              />
              <FieldDescription id="geminiApiKey-description">
                Askora validates a replacement before saving it. The saved key is
                never displayed, even partially.
              </FieldDescription>
              <FieldError
                id="geminiApiKey-message"
                message={fieldErrors.geminiApiKey}
              />
            </Field>
          </fieldset>
          <PendingButton
            className="self-start"
            disabled={disabled}
            pendingName="intent"
            pendingText={settings.connected ? "Replacing key" : "Connecting Gemini"}
            pendingValue="connect"
            type="submit"
          >
            <KeyRound data-icon="inline-start" />
            {settings.connected ? "Replace key" : "Connect Gemini"}
          </PendingButton>
        </Form>

        {settings.connected ? (
          <Form method="post">
            <input name="intent" type="hidden" value="disconnect" />
            <PendingButton
              disabled={disabled}
              pendingName="intent"
              pendingText="Disconnecting"
              pendingValue="disconnect"
              type="submit"
              variant="outline"
            >
              <Trash2 data-icon="inline-start" />
              Disconnect Gemini
            </PendingButton>
          </Form>
        ) : undefined}
      </section>

      <section
        aria-labelledby="generation-preferences-heading"
        className="grid gap-4 border-t pt-8"
      >
        <SectionHeading
          description="Choose the model and private interests Askora can use when you ask it to generate questions."
          icon={<Sparkles aria-hidden="true" className="mt-1 size-4 shrink-0" />}
          id="generation-preferences-heading"
          title="Question preferences"
        />
        <Form aria-label="Question generation preferences" method="post">
          <input name="intent" type="hidden" value="save_preferences" />
          <input
            name="questionInterests"
            type="hidden"
            value={interests.join("\n")}
          />
          <FieldGroup className="gap-5">
            <fieldset className="contents" disabled={disabled}>
              <Field
                data-invalid={fieldErrors.modelPreference !== undefined ? true : undefined}
              >
                <FieldLabel htmlFor="modelPreference">Active model</FieldLabel>
                <Select
                  aria-describedby="modelPreference-description modelPreference-message"
                  aria-invalid={fieldErrors.modelPreference !== undefined}
                  id="modelPreference"
                  name="modelPreference"
                  onChange={(event) => {
                    setModelPreference(
                      event.currentTarget.value as QuestionGenerationModelPreference,
                    );
                  }}
                  value={modelPreference}
                >
                  {questionGenerationModelPreferenceValues.map((model) => (
                    <option key={model} value={model}>
                      {modelLabels[model]}
                    </option>
                  ))}
                </Select>
                <FieldDescription id="modelPreference-description">
                  Auto uses Gemini 3.6 Flash. Choose a specific model to avoid
                  automatic fallback.
                </FieldDescription>
                <FieldError
                  id="modelPreference-message"
                  message={fieldErrors.modelPreference}
                />
              </Field>

              <Field
                data-invalid={fieldErrors.questionInterests !== undefined ? true : undefined}
              >
                <FieldLabel htmlFor="questionInterest">Question interests</FieldLabel>
                <div className="flex gap-2">
                  <Input
                    aria-describedby="questionInterest-description questionInterest-message"
                    aria-invalid={fieldErrors.questionInterests !== undefined}
                    dir="auto"
                    id="questionInterest"
                    maxLength={40}
                    onChange={(event) => {
                      setInterestInput(event.currentTarget.value);
                    }}
                    onKeyDown={handleInterestKeyDown}
                    placeholder="Add an interest"
                    value={interestInput}
                  />
                  <Button
                    aria-label="Add interest"
                    disabled={disabled}
                    onClick={addInterest}
                    type="button"
                    variant="outline"
                  >
                    <Plus aria-hidden="true" />
                  </Button>
                </div>
                <FieldDescription id="questionInterest-description">
                  Add up to 12 private interests. Press Enter or comma after each
                  one; each must be 2–40 characters.
                </FieldDescription>
                <InterestList
                  interests={interests}
                  onRemove={(interestIndex) => {
                    setInterests((current) =>
                      current.filter((_, index) => index !== interestIndex),
                    );
                  }}
                />
                <FieldError
                  id="questionInterest-message"
                  message={fieldErrors.questionInterests}
                />
              </Field>
            </fieldset>
            <PendingButton
              className="self-start"
              disabled={disabled}
              pendingName="intent"
              pendingText="Saving preferences"
              pendingValue="save_preferences"
              type="submit"
            >
              <Save data-icon="inline-start" />
              Save preferences
            </PendingButton>
          </FieldGroup>
        </Form>
      </section>

      <section aria-labelledby="data-use-heading" className="grid gap-4 border-t pt-8">
        <SectionHeading
          description="This acknowledgement is required before you generate questions."
          icon={<Sparkles aria-hidden="true" className="mt-1 size-4 shrink-0" />}
          id="data-use-heading"
          title="Data use"
        />
        {settings.disclosureAcknowledged ? (
          <p className="rounded-xl border bg-secondary p-3 text-sm leading-6 text-muted-foreground">
            You acknowledged the current disclosure.
          </p>
        ) : (
          <Form aria-label="Acknowledge data use" className="grid gap-4" method="post">
            <input name="intent" type="hidden" value="acknowledge_disclosure" />
            <label className="flex items-start gap-3 rounded-xl border bg-secondary p-3 text-sm leading-6">
              <input
                aria-describedby="data-use-description data-use-message"
                className="mt-1 size-4 accent-primary"
                disabled={disabled}
                name="acknowledgeDisclosure"
                type="checkbox"
                value="true"
              />
              <span id="data-use-description">
                I understand Askora sends my selected public profile fields,
                saved interests, bounded published questions and answers, an
                optional topic, and generation controls to Google&apos;s Gemini API
                using my key. Private inbox questions, drafts, deleted content,
                reports, and moderation data are excluded.
              </span>
            </label>
            <FieldError
              id="data-use-message"
              message={fieldErrors.acknowledgeDisclosure}
            />
            <PendingButton
              className="self-start"
              disabled={disabled}
              pendingName="intent"
              pendingText="Saving acknowledgement"
              pendingValue="acknowledge_disclosure"
              type="submit"
            >
              Acknowledge disclosure
            </PendingButton>
          </Form>
        )}
      </section>

      <p aria-live="polite" className="sr-only">
        {getLiveMessage(result)}
      </p>
    </div>
  );
}

function SectionHeading({
  description,
  icon,
  id,
  title,
}: {
  description: string;
  icon: ReactNode;
  id: string;
  title: string;
}) {
  return (
    <div className="flex items-start gap-3">
      {icon}
      <div>
        <h2 className="text-base font-semibold" id={id}>
          {title}
        </h2>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function InterestList({
  interests,
  onRemove,
}: {
  interests: string[];
  onRemove: (index: number) => void;
}) {
  if (interests.length === 0) {
    return undefined;
  }

  return (
    <ul aria-label="Saved interests" className="flex flex-wrap gap-2">
      {interests.map((interest, index) => (
        <li key={`${interest}:${String(index)}`}>
          <span className="inline-flex items-center gap-1 rounded-full border bg-card py-1 pl-3 pr-1 text-sm">
            <span dir="auto">{interest}</span>
            <Button
              aria-label={`Remove ${interest}`}
              className="size-7 rounded-full p-0"
              onClick={() => {
                onRemove(index);
              }}
              type="button"
              variant="ghost"
            >
              <Trash2 aria-hidden="true" className="size-3.5" />
            </Button>
          </span>
        </li>
      ))}
    </ul>
  );
}

function getFieldErrors(
  result: QuestionGenerationSettingsSubmissionResult | undefined,
): QuestionGenerationSettingsFieldErrors {
  return result?.status === "invalid" ? result.fieldErrors : {};
}

function isSuccess(
  result: QuestionGenerationSettingsSubmissionResult | undefined,
): result is Extract<
  QuestionGenerationSettingsSubmissionResult,
  { status: "credential_connected" | "credential_replaced" | "credential_disconnected" | "preferences_saved" | "disclosure_acknowledged" }
> {
  return (
    result?.status === "credential_connected" ||
    result?.status === "credential_replaced" ||
    result?.status === "credential_disconnected" ||
    result?.status === "preferences_saved" ||
    result?.status === "disclosure_acknowledged"
  );
}

function getSettingsToastMessage(
  result: QuestionGenerationSettingsSubmissionResult | undefined,
) {
  if (result === undefined) {
    return undefined;
  }

  if (!isSuccess(result)) {
    return result.formError;
  }

  const messages = {
    credential_connected: "Gemini connected.",
    credential_replaced: "Gemini key replaced.",
    credential_disconnected: "Gemini disconnected.",
    preferences_saved: "Question-generation preferences saved.",
    disclosure_acknowledged: "Data-use disclosure acknowledged.",
  } as const;

  return messages[result.status];
}

function getLiveMessage(
  result: QuestionGenerationSettingsSubmissionResult | undefined,
) {
  return getSettingsToastMessage(result);
}
