import { AtSign, Check, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Form, useFetcher } from "react-router";

import { PendingButton } from "~/components/shared/pending-button/pending-button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "~/components/ui/field/field";
import { Input } from "~/components/ui/input/input";
import { Textarea } from "~/components/ui/textarea/textarea";
import type { UsernameAvailabilityData } from "~/features/profile-setup/routes/username-availability.route";
import type {
  ProfileSetupFieldErrors,
  ProfileSetupFormResult,
  ProfileSetupFormValues,
} from "~/features/profile-setup/types/profile-setup.types";
import { getUsernamePolicyIssue } from "~/features/profile-setup/username-policy";

interface SetupFormProps {
  defaults: ProfileSetupFormValues;
  disabled: boolean;
  result: ProfileSetupFormResult | undefined;
  onValuesChange?: (values: ProfileSetupFormValues) => void;
}

const bioMaxLength = 160;
const availabilityDebounceMs = 350;

type AvailabilityState = "idle" | "checking" | "available" | "taken";

export function SetupForm({
  defaults,
  disabled,
  onValuesChange,
  result,
}: SetupFormProps) {
  const initialValues = result?.values ?? defaults;
  const [values, setValues] = useState(initialValues);
  const fieldErrors = getFieldErrors(result);
  const trimmedUsername = values.username.trim();
  const usernamePolicyIssue =
    trimmedUsername.length > 0
      ? getUsernamePolicyIssue(trimmedUsername)
      : undefined;
  const availability = useUsernameAvailability({
    skip: usernamePolicyIssue !== undefined || trimmedUsername.length === 0,
    username: trimmedUsername,
  });
  const usernameError =
    fieldErrors.username ??
    usernamePolicyIssue ??
    (availability === "taken" ? "This username is not available." : undefined);

  function updateValues(partial: Partial<ProfileSetupFormValues>) {
    setValues((current) => {
      const next = { ...current, ...partial };
      onValuesChange?.(next);
      return next;
    });
  }

  return (
    <Form
      aria-label="Set up profile"
      className="rounded-3xl border bg-card p-6 text-card-foreground shadow-[var(--shadow-card)] sm:p-7"
      method="post"
    >
      <FieldGroup className="gap-6">
        <Field data-invalid={usernameError !== undefined ? true : undefined}>
          <FieldLabel htmlFor="username">Username</FieldLabel>
          <div className="relative">
            <AtSign
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              aria-describedby="username-description username-message"
              aria-invalid={usernameError !== undefined}
              autoComplete="username"
              className="pl-9"
              disabled={disabled}
              id="username"
              inputMode="text"
              name="username"
              onChange={(event) => {
                updateValues({ username: event.currentTarget.value });
              }}
              placeholder="your_name"
              required
              value={values.username}
            />
          </div>
          <FieldDescription id="username-description">
            This becomes your public link and cannot be changed later.
            Lowercase letters, numbers, and underscores.
          </FieldDescription>
          <UsernameStatus
            availability={availability}
            error={usernameError}
            username={trimmedUsername}
          />
        </Field>

        <Field
          data-invalid={fieldErrors.displayName !== undefined ? true : undefined}
        >
          <FieldLabel htmlFor="displayName">Display name</FieldLabel>
          <Input
            aria-describedby="display-name-description display-name-message"
            aria-invalid={fieldErrors.displayName !== undefined}
            autoComplete="name"
            disabled={disabled}
            id="displayName"
            maxLength={50}
            name="displayName"
            onChange={(event) => {
              updateValues({ displayName: event.currentTarget.value });
            }}
            placeholder="Your name as visitors see it"
            required
            value={values.displayName}
          />
          <FieldDescription id="display-name-description">
            You can change this anytime in settings.
          </FieldDescription>
          <FieldError
            id="display-name-message"
            message={fieldErrors.displayName}
          />
        </Field>

        <Field data-invalid={fieldErrors.bio !== undefined ? true : undefined}>
          <div className="flex items-center justify-between gap-3">
            <FieldLabel htmlFor="bio">
              Bio{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </FieldLabel>
            <span
              aria-hidden="true"
              className="text-xs tabular-nums text-muted-foreground"
            >
              {values.bio.length}/{bioMaxLength}
            </span>
          </div>
          <Textarea
            aria-describedby="bio-description bio-message"
            aria-invalid={fieldErrors.bio !== undefined}
            disabled={disabled}
            id="bio"
            maxLength={bioMaxLength}
            name="bio"
            onChange={(event) => {
              updateValues({ bio: event.currentTarget.value });
            }}
            placeholder="Tell visitors what they can ask about."
            value={values.bio}
          />
          <FieldDescription id="bio-description">
            Shown under your name on your public profile. Skip it for now if
            you like.
          </FieldDescription>
          <FieldError id="bio-message" message={fieldErrors.bio} />
        </Field>

        <PendingButton
          className="h-11 w-full"
          disabled={disabled}
          pendingText="Creating your profile…"
          type="submit"
        >
          Create profile
        </PendingButton>
      </FieldGroup>
    </Form>
  );
}

function useUsernameAvailability({
  skip,
  username,
}: {
  skip: boolean;
  username: string;
}): AvailabilityState {
  const fetcher = useFetcher<UsernameAvailabilityData>();
  const fetcherLoad = fetcher.load;

  useEffect(() => {
    if (skip || username.length === 0) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      void fetcherLoad(
        `/setup/username-availability?username=${encodeURIComponent(username)}`,
      );
    }, availabilityDebounceMs);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [fetcherLoad, skip, username]);

  if (skip || username.length === 0) {
    return "idle";
  }

  if (fetcher.state !== "idle" || fetcher.data?.username !== username) {
    return "checking";
  }

  if (fetcher.data.availability === "available") {
    return "available";
  }

  if (fetcher.data.availability === "taken") {
    return "taken";
  }

  return "idle";
}

function UsernameStatus({
  availability,
  error,
  username,
}: {
  availability: AvailabilityState;
  error: string | undefined;
  username: string;
}) {
  if (error !== undefined) {
    return <FieldError id="username-message" message={error} />;
  }

  return (
    <p
      aria-live="polite"
      className="flex min-h-6 items-center gap-1.5 text-sm leading-6"
      id="username-message"
    >
      {availability === "checking" ? (
        <>
          <LoaderCircle
            aria-hidden="true"
            className="size-3.5 animate-spin text-muted-foreground motion-reduce:animate-none"
          />
          <span className="text-muted-foreground">
            Checking availability…
          </span>
        </>
      ) : null}
      {availability === "available" ? (
        <>
          <Check aria-hidden="true" className="size-3.5 text-success" />
          <span className="font-medium text-success">
            @{username} is available.
          </span>
        </>
      ) : null}
    </p>
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
