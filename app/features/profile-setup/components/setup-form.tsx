import { AtSign, CheckCircle2, IdCard, MessageSquareText } from "lucide-react";
import { useState } from "react";
import { Form } from "react-router";

import { PendingButton } from "~/components/app/pending-button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import type {
  ProfileSetupFieldErrors,
  ProfileSetupFormResult,
  ProfileSetupFormValues,
} from "~/features/profile-setup/profile-setup.server";
import { getUsernamePolicyIssue } from "~/features/profile-setup/username-policy";

interface SetupFormProps {
  defaults: ProfileSetupFormValues;
  disabled: boolean;
  result: ProfileSetupFormResult | undefined;
}

const bioMaxLength = 160;

export function SetupForm({ defaults, disabled, result }: SetupFormProps) {
  const initialValues = result?.values ?? defaults;
  const [username, setUsername] = useState(initialValues.username);
  const [bio, setBio] = useState(initialValues.bio);
  const fieldErrors = getFieldErrors(result);
  const usernamePolicyIssue =
    username.length > 0 ? getUsernamePolicyIssue(username.trim()) : undefined;
  const usernameMessage = fieldErrors.username ?? usernamePolicyIssue;

  return (
    <Form aria-label="Set up profile" className="border-y py-6" method="post">
      <FieldGroup>
        {result?.formError === undefined ? undefined : (
          <p className="text-sm leading-6 text-destructive" role="alert">
            {result.formError}
          </p>
        )}

        <Field data-invalid={usernameMessage !== undefined ? true : undefined}>
          <FieldLabel htmlFor="username">Username</FieldLabel>
          <div className="relative">
            <AtSign
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              aria-describedby="username-description username-message"
              aria-invalid={usernameMessage !== undefined}
              autoComplete="username"
              className="pl-9"
              disabled={disabled}
              id="username"
              inputMode="text"
              name="username"
              onChange={(event) => {
                setUsername(event.currentTarget.value);
              }}
              placeholder="your_name"
              value={username}
            />
          </div>
          <FieldDescription id="username-description">
            Lowercase letters, numbers, and underscores only.
          </FieldDescription>
          <ValidationMessage
            id="username-message"
            message={usernameMessage}
            valid={username.length > 0 && usernameMessage === undefined}
          />
        </Field>

        <Field
          data-invalid={fieldErrors.displayName !== undefined ? true : undefined}
        >
          <FieldLabel htmlFor="displayName">Display name</FieldLabel>
          <div className="relative">
            <IdCard
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              aria-describedby="display-name-message"
              aria-invalid={fieldErrors.displayName !== undefined}
              autoComplete="name"
              className="pl-9"
              defaultValue={initialValues.displayName}
              disabled={disabled}
              id="displayName"
              maxLength={50}
              name="displayName"
              placeholder="Your display name"
            />
          </div>
          <ValidationMessage
            id="display-name-message"
            message={fieldErrors.displayName}
          />
        </Field>

        <Field data-invalid={fieldErrors.bio !== undefined ? true : undefined}>
          <div className="flex items-center justify-between gap-3">
            <FieldLabel htmlFor="bio">Bio</FieldLabel>
            <span className="text-xs tabular-nums text-muted-foreground">
              {bio.length}/{bioMaxLength}
            </span>
          </div>
          <div className="relative">
            <MessageSquareText
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground"
            />
            <Textarea
              aria-describedby="bio-description bio-message"
              aria-invalid={fieldErrors.bio !== undefined}
              className="pl-9"
              disabled={disabled}
              id="bio"
              maxLength={bioMaxLength}
              name="bio"
              onChange={(event) => {
                setBio(event.currentTarget.value);
              }}
              placeholder="Optional: tell visitors what they can ask about."
              value={bio}
            />
          </div>
          <FieldDescription id="bio-description">
            Optional. Keep it short enough to fit profile previews.
          </FieldDescription>
          <ValidationMessage id="bio-message" message={fieldErrors.bio} />
        </Field>

        <PendingButton
          className="w-full sm:w-auto"
          disabled={disabled}
          pendingText="Creating profile"
          type="submit"
        >
          <CheckCircle2 data-icon="inline-start" />
          Create profile
        </PendingButton>
      </FieldGroup>
    </Form>
  );
}

function getFieldErrors(
  result: ProfileSetupFormResult | undefined,
): ProfileSetupFieldErrors {
  if (result?.status === "invalid" || result?.status === "username_taken") {
    return result.fieldErrors;
  }

  return {};
}

function ValidationMessage({
  id,
  message,
  valid = false,
}: {
  id: string;
  message: string | undefined;
  valid?: boolean;
}) {
  if (message !== undefined) {
    return (
      <p className="text-sm leading-6 text-destructive" id={id} role="alert">
        {message}
      </p>
    );
  }

  if (valid) {
    return (
      <p className="text-sm leading-6 text-muted-foreground" id={id}>
        Username format looks good.
      </p>
    );
  }

  return <span id={id} />;
}
