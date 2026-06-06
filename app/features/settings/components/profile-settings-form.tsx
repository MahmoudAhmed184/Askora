import {
  AlertTriangle,
  AtSign,
  IdCard,
  Image,
  MessageSquareText,
  RotateCcw,
  Save,
} from "lucide-react";
import { useState } from "react";
import { Form } from "react-router";

import { ActionToast } from "~/components/app/action-toast";
import { PendingButton } from "~/components/app/pending-button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import {
  type ProfileSettingsFieldErrors,
  type ProfileSettingsSubmissionResult,
  type ProfileSettingsViewData,
} from "~/features/settings/profile-settings.server";
import type { AvatarSource } from "~/features/settings/settings.schema";
import { getUsernamePolicyIssue } from "~/features/profile-setup/username-policy";
import { cn } from "~/lib/utils";

interface ProfileSettingsFormProps {
  settings: ProfileSettingsViewData;
  disabled: boolean;
  result: ProfileSettingsSubmissionResult | undefined;
}

const bioMaxLength = 160;

export function ProfileSettingsForm({
  settings,
  disabled,
  result,
}: ProfileSettingsFormProps) {
  const initialValues = result?.values ?? settings.values;
  const [username, setUsername] = useState(initialValues.username);
  const [displayName, setDisplayName] = useState(initialValues.displayName);
  const [bio, setBio] = useState(initialValues.bio);
  const [avatarSource, setAvatarSource] = useState<AvatarSource>(
    initialValues.avatarSource,
  );
  const fieldErrors = getFieldErrors(result);
  const usernamePolicyIssue =
    username.length > 0 ? getUsernamePolicyIssue(username.trim()) : undefined;
  const usernameMessage = fieldErrors.username ?? usernamePolicyIssue;
  const googleAvatarAvailable = settings.googleAvatarUrl !== undefined;

  return (
    <Form
      aria-label="Profile settings"
      className="p-5 text-card-foreground sm:p-6"
      method="post"
    >
      <ActionToast
        message={getProfileSettingsToastMessage({
          redirectReservationDays: settings.redirectReservationDays,
          result,
        })}
        tone={result?.status === "updated" ? "success" : "error"}
        trigger={result}
      />
      <FieldGroup className="gap-5">
        {disabled ? <LockedNotice /> : undefined}

        <fieldset className="contents" disabled={disabled}>
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
              Lowercase letters, numbers, and underscores only. Previous
              usernames stay reserved and redirect for{" "}
              {settings.redirectReservationDays} days after a change.
            </FieldDescription>
            <ValidationMessage
              id="username-message"
              message={usernameMessage}
              valid={username.length > 0 && usernameMessage === undefined}
            />
            {settings.usernameCooldown?.isActive === true ? (
              <p className="flex items-start gap-2 text-sm leading-6 text-muted-foreground">
                <RotateCcw
                  aria-hidden="true"
                  className="mt-1 size-4 shrink-0 text-foreground"
                />
                Username changes reopen on{" "}
                {settings.usernameCooldown.nextChangeDate}. Profile details can
                still be saved.
              </p>
            ) : undefined}
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
                id="displayName"
                maxLength={50}
                name="displayName"
                onChange={(event) => {
                  setDisplayName(event.currentTarget.value);
                }}
                placeholder="Your display name"
                value={displayName}
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
              Optional public copy shown on profile previews.
            </FieldDescription>
            <ValidationMessage id="bio-message" message={fieldErrors.bio} />
          </Field>

          <Field
            data-invalid={fieldErrors.avatarSource !== undefined ? true : undefined}
          >
            <FieldLabel>Avatar source</FieldLabel>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <AvatarSourceOption
                checked={avatarSource === "google"}
                description={
                  googleAvatarAvailable
                    ? "Use the image from your Google account."
                    : "No Google image is available for this account."
                }
                disabled={!googleAvatarAvailable}
                imageUrl={settings.googleAvatarUrl}
                label="Google"
                name="avatarSource"
                onChange={setAvatarSource}
                value="google"
              />
              <AvatarSourceOption
                checked={avatarSource === "fallback"}
                description="Use a generated profile initial."
                imageUrl={undefined}
                label="Generated"
                name="avatarSource"
                onChange={setAvatarSource}
                value="fallback"
              />
            </div>
            <ValidationMessage
              id="avatar-source-message"
              message={fieldErrors.avatarSource}
            />
          </Field>
        </fieldset>

        <PendingButton
          className="self-start"
          disabled={disabled}
          pendingText="Saving profile"
          type="submit"
        >
          <Save data-icon="inline-start" />
          Save profile
        </PendingButton>
      </FieldGroup>
    </Form>
  );
}

function AvatarSourceOption({
  checked,
  description,
  disabled = false,
  imageUrl,
  label,
  name,
  onChange,
  value,
}: {
  checked: boolean;
  description: string;
  disabled?: boolean;
  imageUrl: string | undefined;
  label: string;
  name: string;
  onChange: (value: AvatarSource) => void;
  value: AvatarSource;
}) {
  return (
    <label
      className={cn(
        "flex min-h-24 gap-3 rounded-xl border bg-secondary p-3 text-sm transition-colors",
        checked ? "border-foreground/25" : "border-border",
        disabled ? "opacity-60" : "hover:border-foreground/20",
      )}
    >
      <input
        checked={checked}
        className="mt-1 size-4 accent-primary"
        disabled={disabled}
        name={name}
        onChange={() => {
          onChange(value);
        }}
        type="radio"
        value={value}
      />
      <span className="flex min-w-0 flex-1 items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary text-sm font-semibold text-secondary-foreground">
          {imageUrl === undefined ? (
            <Image aria-hidden="true" className="size-4" />
          ) : (
            <img alt="" className="size-full object-cover" src={imageUrl} />
          )}
        </span>
        <span className="min-w-0">
          <span className="block font-medium">{label}</span>
          <span className="mt-1 block leading-5 text-muted-foreground">
            {description}
          </span>
        </span>
      </span>
    </label>
  );
}

function LockedNotice() {
  return (
    <div className="flex items-start gap-3 rounded-2xl border bg-secondary/70 px-4 py-3 text-sm leading-6 text-muted-foreground">
      <AlertTriangle
        aria-hidden="true"
        className="mt-0.5 size-4 shrink-0 text-destructive"
      />
      Profile settings are locked while this account is suspended.
    </div>
  );
}

function getProfileSettingsToastMessage({
  redirectReservationDays,
  result,
}: {
  redirectReservationDays: number;
  result: ProfileSettingsSubmissionResult | undefined;
}) {
  if (result?.status !== "updated") {
    return getFormError(result);
  }

  if (!result.usernameChanged) {
    return "Profile saved.";
  }

  if (!result.previousUsername || !result.redirectUntilDate) {
    return "Profile saved.";
  }

  return `Profile saved. @${result.previousUsername} redirects to @${result.values.username} through ${result.redirectUntilDate}; the old username stays reserved for ${String(redirectReservationDays)} days.`;
}

function getFieldErrors(
  result: ProfileSettingsSubmissionResult | undefined,
): ProfileSettingsFieldErrors {
  if (
    result?.status === "invalid" ||
    result?.status === "username_taken" ||
    result?.status === "cooldown"
  ) {
    return result.fieldErrors;
  }

  return {};
}

function getFormError(result: ProfileSettingsSubmissionResult | undefined) {
  if (
    result?.status === "invalid" ||
    result?.status === "username_taken" ||
    result?.status === "cooldown" ||
    result?.status === "suspended" ||
    result?.status === "not_found" ||
    result?.status === "stale"
  ) {
    return result.formError;
  }

  return undefined;
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
