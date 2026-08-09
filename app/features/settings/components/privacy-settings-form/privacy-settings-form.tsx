import { AlertTriangle, Eye, MessageCircle, Save } from "lucide-react";
import { useState } from "react";
import { Form } from "react-router";

import { ActionToast } from "~/components/shared/action-toast/action-toast";
import { PendingButton } from "~/components/shared/pending-button/pending-button";
import { SettingsSwitchField } from "~/features/settings/components/settings-switch-field";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "~/components/ui/field/field";
import { Select } from "~/components/ui/select/select";
import type {
  PrivacySettingsFieldErrors,
  PrivacySettingsFormValues,
  PrivacySettingsSubmissionResult,
} from "~/features/settings/types/settings.types";
import type {
  AskPermission,
  FollowUpPermission,
} from "~/features/settings/validations/settings.validations";

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

  return (
    <Form
      aria-label="Privacy settings"
      className="p-5 text-card-foreground sm:p-6"
      method="post"
    >
      <ActionToast
        message={getPrivacySettingsToastMessage(result)}
        tone={result?.status === "updated" ? "success" : "error"}
        trigger={result}
      />
      <FieldGroup className="gap-5">
        {disabled ? <LockedNotice /> : undefined}

        <fieldset className="contents" disabled={disabled}>
          <section
            aria-labelledby="questions-heading"
            className="flex flex-col gap-4"
          >
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
                  Control who can start questions and how follow-up threads
                  open.
                </p>
              </div>
            </div>

            <ToggleField
              checked={values.anonymousQuestionsEnabled}
              disabled={disabled}
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

          <section
            aria-labelledby="visibility-heading"
            className="flex flex-col gap-4"
          >
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
              disabled={disabled}
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
              disabled={disabled}
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
          className="self-start"
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

function getPrivacySettingsToastMessage(
  result: PrivacySettingsSubmissionResult | undefined,
) {
  if (result?.status === "updated") {
    return "Privacy settings saved.";
  }

  return getFormError(result);
}

function ToggleField({
  checked,
  description,
  disabled,
  label,
  name,
  onChange,
}: {
  checked: boolean;
  description: string;
  disabled: boolean;
  label: string;
  name: keyof Pick<
    PrivacySettingsFormValues,
    "anonymousQuestionsEnabled" | "showFollowerCounts" | "showLikeCounts"
  >;
  onChange: (checked: boolean) => void;
}) {
  return (
    <SettingsSwitchField
      checked={checked}
      description={description}
      disabled={disabled}
      label={label}
      name={name}
      onChange={onChange}
    />
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
      <Select
        aria-describedby={`${id}-description ${messageId}`}
        aria-invalid={error !== undefined}
        id={id}
        name={name}
        onValueChange={(value) => {
          onChange(value);
        }}
        value={value}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
      <FieldDescription id={`${id}-description`}>
        {description}
      </FieldDescription>
      {error === undefined ? (
        <span id={messageId} />
      ) : (
        <p
          className="text-sm leading-6 text-destructive"
          id={messageId}
          role="alert"
        >
          {error}
        </p>
      )}
    </Field>
  );
}

function LockedNotice() {
  return (
    <div className="flex items-start gap-3 rounded-2xl border bg-secondary/70 px-4 py-3 text-sm leading-6 text-muted-foreground">
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
