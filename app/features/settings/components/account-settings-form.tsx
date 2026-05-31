import {
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  ShieldOff,
  Trash2,
  Undo2,
} from "lucide-react";
import { useState, type ComponentProps, type ReactNode } from "react";
import { Form } from "react-router";

import { PendingButton } from "~/components/app/pending-button";
import type { Button } from "~/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import {
  type AccountSettingsFieldErrors,
  type AccountSettingsSubmissionResult,
  type AccountSettingsViewData,
} from "~/features/settings/account-settings.server";
import type { AccountAction } from "~/features/settings/settings.schema";
import { cn } from "~/lib/utils";

interface AccountSettingsFormProps {
  settings: AccountSettingsViewData;
  isSuspended: boolean;
  result: AccountSettingsSubmissionResult | undefined;
}

export function AccountSettingsForm({
  isSuspended,
  result,
  settings,
}: AccountSettingsFormProps) {
  const formError = getFormError(result);

  return (
    <div className="border-y py-6">
      <FieldGroup className="gap-6">
        {formError === undefined ? undefined : (
          <p className="text-sm leading-6 text-destructive" role="alert">
            {formError}
          </p>
        )}
        <SuccessNotice result={result} />

        <section aria-labelledby="profile-lifecycle-heading" className="grid gap-4">
          <SectionHeader
            description="Hide or restore your public profile without deleting the account."
            icon={<ShieldOff aria-hidden="true" className="size-4" />}
            title="Profile availability"
            titleId="profile-lifecycle-heading"
          />
          <ProfileState settings={settings} />
          <ProfileLifecycleAction
            isSuspended={isSuspended}
            result={result}
            settings={settings}
          />
        </section>

        <section aria-labelledby="deletion-heading" className="grid gap-4 border-t pt-6">
          <SectionHeader
            description={`Request account deletion with a ${String(settings.deletionGraceDays)}-day cancellation window.`}
            icon={<Trash2 aria-hidden="true" className="size-4" />}
            title="Account deletion"
            titleId="deletion-heading"
          />
          <DeletionState settings={settings} />
          <DeletionAction result={result} settings={settings} />
        </section>
      </FieldGroup>
    </div>
  );
}

function SectionHeader({
  description,
  icon,
  title,
  titleId,
}: {
  description: string;
  icon: ReactNode;
  title: string;
  titleId: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-1 text-muted-foreground">{icon}</span>
      <div>
        <h2 className="text-base font-semibold" id={titleId}>
          {title}
        </h2>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function ProfileState({ settings }: { settings: AccountSettingsViewData }) {
  const label = settings.profile.isActive ? "Profile is public" : "Profile is hidden";
  const detail = settings.profile.isActive
    ? `@${settings.profile.username} is visible on public profile and thread pages.`
    : getInactiveProfileDetail(settings);

  return <StatePanel label={label} tone={settings.profile.isActive ? "default" : "warning"}>{detail}</StatePanel>;
}

function ProfileLifecycleAction({
  isSuspended,
  result,
  settings,
}: {
  isSuspended: boolean;
  result: AccountSettingsSubmissionResult | undefined;
  settings: AccountSettingsViewData;
}) {
  if (settings.deletion.status === "pending") {
    return (
      <p className="text-sm leading-6 text-muted-foreground">
        Profile controls are paused while account deletion is pending.
      </p>
    );
  }

  if (settings.profile.isActive) {
    return (
      <ConfirmationActionForm
        buttonLabel="Deactivate profile"
        confirmationLabel="Type DEACTIVATE"
        confirmationToken="DEACTIVATE"
        description="Your profile and public threads become unavailable until you reactivate."
        intent="deactivate"
        pendingText="Deactivating"
        result={result}
        variant="outline"
      />
    );
  }

  if (settings.profile.deactivationReason !== "user") {
    return (
      <p className="flex items-start gap-2 text-sm leading-6 text-muted-foreground">
        <AlertTriangle
          aria-hidden="true"
          className="mt-1 size-4 shrink-0 text-destructive"
        />
        This profile cannot be reactivated from account settings.
      </p>
    );
  }

  return (
    <Form aria-label="Reactivate profile" method="post">
      <input name="intent" type="hidden" value="reactivate" />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <PendingButton
          className="w-full sm:w-auto"
          disabled={isSuspended}
          pendingText="Reactivating"
          type="submit"
        >
          <RotateCcw data-icon="inline-start" />
          Reactivate profile
        </PendingButton>
        {isSuspended ? (
          <p className="text-sm leading-6 text-muted-foreground">
            Reactivation is locked while this account is suspended.
          </p>
        ) : undefined}
      </div>
    </Form>
  );
}

function DeletionState({ settings }: { settings: AccountSettingsViewData }) {
  if (settings.deletion.status === "pending") {
    return (
      <StatePanel label="Deletion requested" tone="danger">
        {settings.deletion.graceEndsDate === null
          ? "Cleanup will run after the grace period ends."
          : `Cleanup can run after ${settings.deletion.graceEndsDate}.`}
      </StatePanel>
    );
  }

  if (settings.deletion.status === "completed") {
    return (
      <StatePanel label="Deletion cleanup completed" tone="danger">
        Account identity was anonymized on{" "}
        {settings.deletion.anonymizedAt.slice(0, 10)}.
      </StatePanel>
    );
  }

  return (
    <StatePanel label="No deletion request" tone="default">
      Requesting deletion immediately hides your profile and starts the grace
      period.
    </StatePanel>
  );
}

function DeletionAction({
  result,
  settings,
}: {
  result: AccountSettingsSubmissionResult | undefined;
  settings: AccountSettingsViewData;
}) {
  if (settings.deletion.status === "pending") {
    return (
      <Form aria-label="Cancel account deletion" method="post">
        <input name="intent" type="hidden" value="cancel_deletion" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <PendingButton
            className="w-full sm:w-auto"
            pendingText="Cancelling deletion"
            type="submit"
            variant="outline"
          >
            <Undo2 data-icon="inline-start" />
            Cancel deletion request
          </PendingButton>
          <p className="text-sm leading-6 text-muted-foreground">
            Your profile stays hidden until you explicitly reactivate it.
          </p>
        </div>
      </Form>
    );
  }

  if (settings.deletion.status === "completed") {
    return undefined;
  }

  return (
    <ConfirmationActionForm
      buttonLabel="Request account deletion"
      confirmationLabel="Type DELETE"
      confirmationToken="DELETE"
      description="Your account enters the deletion grace period. The cleanup job anonymizes identity after the window ends."
      intent="request_deletion"
      pendingText="Requesting deletion"
      result={result}
      variant="destructive"
    />
  );
}

function ConfirmationActionForm({
  buttonLabel,
  confirmationLabel,
  confirmationToken,
  description,
  intent,
  pendingText,
  result,
  variant,
}: {
  buttonLabel: string;
  confirmationLabel: string;
  confirmationToken: "DEACTIVATE" | "DELETE";
  description: string;
  intent: Extract<AccountAction, "deactivate" | "request_deletion">;
  pendingText: string;
  result: AccountSettingsSubmissionResult | undefined;
  variant: ComponentProps<typeof Button>["variant"];
}) {
  const [confirmation, setConfirmation] = useState("");
  const error = getConfirmationError(result, intent);
  const inputId = `${intent}-confirmation`;
  const descriptionId = `${intent}-description`;
  const messageId = `${intent}-message`;
  const buttonDisabled = confirmation !== confirmationToken;

  return (
    <Form aria-label={buttonLabel} className="grid gap-3" method="post">
      <input name="intent" type="hidden" value={intent} />
      <Field data-invalid={error !== undefined ? true : undefined}>
        <FieldLabel htmlFor={inputId}>{confirmationLabel}</FieldLabel>
        <Input
          aria-describedby={`${descriptionId} ${messageId}`}
          aria-invalid={error !== undefined}
          autoComplete="off"
          id={inputId}
          name="confirmation"
          onChange={(event) => {
            setConfirmation(event.currentTarget.value);
          }}
          value={confirmation}
        />
        <FieldDescription id={descriptionId}>{description}</FieldDescription>
        {error === undefined ? (
          <span id={messageId} />
        ) : (
          <p className="text-sm leading-6 text-destructive" id={messageId} role="alert">
            {error}
          </p>
        )}
      </Field>
      <PendingButton
        className="w-full sm:w-auto"
        disabled={buttonDisabled}
        pendingText={pendingText}
        type="submit"
        variant={variant}
      >
        {intent === "deactivate" ? (
          <ShieldOff data-icon="inline-start" />
        ) : (
          <Trash2 data-icon="inline-start" />
        )}
        {buttonLabel}
      </PendingButton>
    </Form>
  );
}

function StatePanel({
  children,
  label,
  tone,
}: {
  children: ReactNode;
  label: string;
  tone: "default" | "warning" | "danger";
}) {
  return (
    <div
      className={cn(
        "rounded-md border bg-background p-4 text-sm leading-6",
        tone === "danger" ? "border-destructive/35" : undefined,
      )}
    >
      <p className="font-medium text-foreground">{label}</p>
      <p className="mt-1 text-muted-foreground">{children}</p>
    </div>
  );
}

function SuccessNotice({
  result,
}: {
  result: AccountSettingsSubmissionResult | undefined;
}) {
  if (
    result?.status !== "deactivated" &&
    result?.status !== "reactivated" &&
    result?.status !== "deletion_requested" &&
    result?.status !== "deletion_cancelled"
  ) {
    return undefined;
  }

  return (
    <p className="flex items-start gap-2 text-sm leading-6 text-muted-foreground" role="status">
      <CheckCircle2
        aria-hidden="true"
        className="mt-1 size-4 shrink-0 text-foreground"
      />
      {getSuccessMessage(result.status)}
    </p>
  );
}

function getSuccessMessage(
  status: Extract<
    AccountSettingsSubmissionResult["status"],
    "deactivated" | "reactivated" | "deletion_requested" | "deletion_cancelled"
  >,
) {
  switch (status) {
    case "deactivated":
      return "Profile deactivated.";
    case "reactivated":
      return "Profile reactivated.";
    case "deletion_requested":
      return "Account deletion requested.";
    case "deletion_cancelled":
      return "Account deletion cancelled. Your profile remains hidden.";
  }
}

function getInactiveProfileDetail(settings: AccountSettingsViewData) {
  if (settings.profile.deactivationReason === "admin") {
    return "This profile is unavailable and cannot be restored from account settings.";
  }

  if (settings.profile.deactivationReason === "account_deletion") {
    return "This profile is hidden because account deletion is pending.";
  }

  return "This profile is hidden from public profile and thread pages.";
}

function getConfirmationError(
  result: AccountSettingsSubmissionResult | undefined,
  intent: AccountAction,
) {
  const errors = getFieldErrors(result);

  if (result?.values.intent !== intent) {
    return undefined;
  }

  return errors.confirmation;
}

function getFieldErrors(
  result: AccountSettingsSubmissionResult | undefined,
): AccountSettingsFieldErrors {
  return result?.status === "invalid" ? result.fieldErrors : {};
}

function getFormError(result: AccountSettingsSubmissionResult | undefined) {
  if (
    result?.status === "invalid" ||
    result?.status === "not_found" ||
    result?.status === "pending_deletion" ||
    result?.status === "deletion_completed" ||
    result?.status === "no_pending_deletion" ||
    result?.status === "not_user_deactivated" ||
    result?.status === "suspended"
  ) {
    return result.formError;
  }

  return undefined;
}
