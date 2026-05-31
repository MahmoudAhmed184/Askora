import { AlertTriangle, CheckCircle2, Eye, MessageCircle, Save } from "lucide-react";
import { useState } from "react";
import { Form } from "react-router";

import { PendingButton } from "~/components/app/pending-button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "~/components/ui/field";
import {
  type PrivacySettingsFieldErrors,
  type PrivacySettingsFormValues,
  type PrivacySettingsSubmissionResult,
} from "~/features/settings/privacy-settings.server";
import type {
  AskPermission,
  FollowUpPermission,
} from "~/features/settings/settings.schema";
import { cn } from "~/lib/utils";

interface PrivacySettingsFormProps {
  settings: PrivacySettingsFormValues;
  disabled: boolean;
  result: PrivacySettingsSubmissionResult | undefined;
}

const askPermissionOptions = [
  { value: "everyone", label: "Everyone" },
  { value: "logged_in", label: "Logged-in users" },
  { value: "followers", label: "Followers" },
  { value: "off", label: "No one" },
] as const satisfies readonly { value: AskPermission; label: string }[];

const followUpPermissionOptions = [
  { value: "anyone", label: "Anyone in the thread" },
  { value: "logged_in", label: "Logged-in users" },
  { value: "original_asker", label: "Original asker only" },
  { value: "off", label: "No follow-ups" },
] as const satisfies readonly { value: FollowUpPermission; label: string }[];

export function PrivacySettingsForm({
  settings,
  disabled,
  result,
}: PrivacySettingsFormProps) {
  const initialValues = result?.values ?? settings;
  const [values, setValues] = useState(initialValues);
  const fieldErrors = getFieldErrors(result);
  const formError = getFormError(result);

  return (
    <Form aria-label="Privacy settings" className="border-y py-6" method="post">
      <FieldGroup className="gap-5">
        {disabled ? <LockedNotice /> : undefined}
        {formError === undefined ? undefined : (
          <p className="text-sm leading-6 text-destructive" role="alert">
            {formError}
          </p>
        )}
        {result?.status === "updated" ? (
          <p className="flex items-start gap-2 text-sm leading-6 text-muted-foreground" role="status">
            <CheckCircle2
              aria-hidden="true"
              className="mt-1 size-4 shrink-0 text-foreground"
            />
            Privacy settings saved.
          </p>
        ) : undefined}

        <fieldset className="contents" disabled={disabled}>
          <section aria-labelledby="questions-heading" className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <MessageCircle
                aria-hidden="true"
                className="mt-1 size-4 shrink-0 text-muted-foreground"
              />
              <div>
                <h2 className="text-base font-semibold" id="questions-heading">
                  Question intake
                </h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  Control who can start questions and how follow-up threads open.
                </p>
              </div>
            </div>

            <ToggleField
              checked={values.anonymousQuestionsEnabled}
              description="Allow visitors to ask without showing a public identity."
              label="Anonymous questions"
              name="anonymousQuestionsEnabled"
              onChange={(checked) => {
                setValues((current) => ({
                  ...current,
                  anonymousQuestionsEnabled: checked,
                }));
              }}
            />

            <SelectField
              description="This maps to the profile ask permission setting."
              error={fieldErrors.askPermission}
              id="askPermission"
              label="Who can ask"
              name="askPermission"
              onChange={(value) => {
                setValues((current) => ({
                  ...current,
                  askPermission: value as AskPermission,
                }));
              }}
              options={askPermissionOptions}
              value={values.askPermission}
            />

            <SelectField
              description="Default access for follow-up replies on published answers."
              error={fieldErrors.followUpPermissionDefault}
              id="followUpPermissionDefault"
              label="Follow-up default"
              name="followUpPermissionDefault"
              onChange={(value) => {
                setValues((current) => ({
                  ...current,
                  followUpPermissionDefault: value as FollowUpPermission,
                }));
              }}
              options={followUpPermissionOptions}
              value={values.followUpPermissionDefault}
            />
          </section>

          <section aria-labelledby="visibility-heading" className="flex flex-col gap-4">
            <div className="flex items-start gap-3 border-t pt-5">
              <Eye
                aria-hidden="true"
                className="mt-1 size-4 shrink-0 text-muted-foreground"
              />
              <div>
                <h2 className="text-base font-semibold" id="visibility-heading">
                  Public counts
                </h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  Choose which aggregate counts are visible on public surfaces.
                </p>
              </div>
            </div>

            <ToggleField
              checked={values.showFollowerCounts}
              description="Show follower and following totals publicly."
              label="Follower and following counts"
              name="showFollowerCounts"
              onChange={(checked) => {
                setValues((current) => ({
                  ...current,
                  showFollowerCounts: checked,
                }));
              }}
            />

            <ToggleField
              checked={values.showLikeCounts}
              description="Show public reaction totals on profiles and threads."
              label="Reaction counts"
              name="showLikeCounts"
              onChange={(checked) => {
                setValues((current) => ({
                  ...current,
                  showLikeCounts: checked,
                }));
              }}
            />
          </section>
        </fieldset>

        <PendingButton
          className="w-full sm:w-auto"
          disabled={disabled}
          pendingText="Saving privacy"
          type="submit"
        >
          <Save data-icon="inline-start" />
          Save privacy
        </PendingButton>
      </FieldGroup>
    </Form>
  );
}

function ToggleField({
  checked,
  description,
  label,
  name,
  onChange,
}: {
  checked: boolean;
  description: string;
  label: string;
  name: keyof Pick<
    PrivacySettingsFormValues,
    "anonymousQuestionsEnabled" | "showFollowerCounts" | "showLikeCounts"
  >;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 rounded-md border bg-background p-3">
      <input
        checked={checked}
        className="mt-1 size-4 accent-primary"
        name={name}
        onChange={(event) => {
          onChange(event.currentTarget.checked);
        }}
        type="checkbox"
      />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="mt-1 block text-sm leading-6 text-muted-foreground">
          {description}
        </span>
      </span>
    </label>
  );
}

function SelectField({
  description,
  error,
  id,
  label,
  name,
  onChange,
  options,
  value,
}: {
  description: string;
  error: string | undefined;
  id: string;
  label: string;
  name: string;
  onChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
  value: string;
}) {
  const messageId = `${id}-message`;

  return (
    <Field data-invalid={error !== undefined ? true : undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <select
        aria-describedby={`${id}-description ${messageId}`}
        aria-invalid={error !== undefined}
        className={cn(
          "flex h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20",
        )}
        id={id}
        name={name}
        onChange={(event) => {
          onChange(event.currentTarget.value);
        }}
        value={value}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <FieldDescription id={`${id}-description`}>{description}</FieldDescription>
      {error === undefined ? (
        <span id={messageId} />
      ) : (
        <p className="text-sm leading-6 text-destructive" id={messageId} role="alert">
          {error}
        </p>
      )}
    </Field>
  );
}

function LockedNotice() {
  return (
    <div className="flex items-start gap-3 border-l px-4 py-1 text-sm leading-6 text-muted-foreground">
      <AlertTriangle
        aria-hidden="true"
        className="mt-0.5 size-4 shrink-0 text-destructive"
      />
      Privacy settings are locked while this account is suspended.
    </div>
  );
}

function getFieldErrors(
  result: PrivacySettingsSubmissionResult | undefined,
): PrivacySettingsFieldErrors {
  return result?.status === "invalid" ? result.fieldErrors : {};
}

function getFormError(result: PrivacySettingsSubmissionResult | undefined) {
  if (
    result?.status === "invalid" ||
    result?.status === "suspended" ||
    result?.status === "not_found"
  ) {
    return result.formError;
  }

  return undefined;
}
