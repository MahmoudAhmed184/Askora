import {
  AlertTriangle,
  RotateCcw,
  ShieldOff,
  Trash2,
  Undo2,
} from "lucide-react";
import { useRef, useState, type ComponentProps, type ReactNode } from "react";
import { Form, useNavigation } from "react-router";

import { ActionToast } from "~/components/app/action-toast";
import { PendingButton } from "~/components/app/pending-button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import { buttonVariants } from "~/components/ui/button-variants";
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

type AccountSettingsSuccessResult = Extract<
  AccountSettingsSubmissionResult,
  {
    status:
      | "deactivated"
      | "reactivated"
      | "deletion_requested"
      | "deletion_cancelled";
  }
>;

export function AccountSettingsForm({
  isSuspended,
  result,
  settings,
}: AccountSettingsFormProps) {
  return (
    <div className="p-5 text-card-foreground sm:p-6">
      <ActionToast
        message={getAccountSettingsToastMessage(result)}
        tone={isAccountSuccessResult(result) ? "success" : "error"}
        trigger={result}
      />
      <FieldGroup className="gap-5">
        <section aria-labelledby="profile-lifecycle-heading" className="grid gap-3">
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

        <section aria-labelledby="deletion-heading" className="grid gap-3 border-t pt-5">
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
        dialogDescription="Your profile and public threads will become unavailable until you reactivate from account settings."
        dialogTitle="Deactivate profile?"
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
          className="self-start"
          disabled={isSuspended}
          pendingName="intent"
          pendingText="Reactivating"
          pendingValue="reactivate"
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
            className="self-start"
            pendingName="intent"
            pendingText="Cancelling deletion"
            pendingValue="cancel_deletion"
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
      dialogDescription={`Your profile will hide immediately. Cleanup can anonymize account identity after the ${String(settings.deletionGraceDays)}-day grace period.`}
      dialogTitle="Request account deletion?"
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
  dialogDescription,
  dialogTitle,
  intent,
  pendingText,
  result,
  variant,
}: {
  buttonLabel: string;
  confirmationLabel: string;
  confirmationToken: "DEACTIVATE" | "DELETE";
  description: string;
  dialogDescription: string;
  dialogTitle: string;
  intent: Extract<AccountAction, "deactivate" | "request_deletion">;
  pendingText: string;
  result: AccountSettingsSubmissionResult | undefined;
  variant: ComponentProps<typeof Button>["variant"];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const confirmedSubmitRef = useRef(false);
  const [confirmation, setConfirmation] = useState("");
  const [clientError, setClientError] = useState<string | undefined>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const error = clientError ?? getConfirmationError(result, intent);
  const inputId = `${intent}-confirmation`;
  const descriptionId = `${intent}-description`;
  const messageId = `${intent}-message`;
  const buttonDisabled = confirmation !== confirmationToken || isSubmitting;

  return (
    <>
      <Form
        aria-label={buttonLabel}
        className="grid gap-3"
        method="post"
        onSubmit={(event) => {
          if (confirmedSubmitRef.current) {
            confirmedSubmitRef.current = false;
            return;
          }

          if (confirmation !== confirmationToken) {
            event.preventDefault();
            setClientError(getConfirmationTokenError(intent));
            return;
          }

          event.preventDefault();
          setDialogOpen(true);
        }}
        ref={formRef}
      >
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
              setClientError(undefined);
            }}
            value={confirmation}
          />
          <FieldDescription id={descriptionId}>{description}</FieldDescription>
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
        <PendingButton
          className="justify-self-start"
          disabled={buttonDisabled}
          pendingName="intent"
          pendingText={pendingText}
          pendingValue={intent}
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

      <ConfirmAccountActionDialog
        actionLabel={buttonLabel}
        description={dialogDescription}
        disabled={isSubmitting}
        intent={intent}
        onConfirm={() => {
          confirmedSubmitRef.current = true;
          formRef.current?.requestSubmit();
        }}
        onOpenChange={setDialogOpen}
        open={dialogOpen}
        title={dialogTitle}
      />
    </>
  );
}

function ConfirmAccountActionDialog({
  actionLabel,
  description,
  disabled,
  intent,
  onConfirm,
  onOpenChange,
  open,
  title,
}: {
  actionLabel: string;
  description: string;
  disabled: boolean;
  intent: Extract<AccountAction, "deactivate" | "request_deletion">;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
}) {
  const destructive = intent === "request_deletion";

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={disabled}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            asChild
            className={buttonVariants({
              variant: destructive ? "destructive" : "default",
            })}
          >
            <Button
              disabled={disabled}
              onClick={onConfirm}
              type="button"
              variant={destructive ? "destructive" : "default"}
            >
              {destructive ? (
                <Trash2 data-icon="inline-start" />
              ) : (
                <ShieldOff data-icon="inline-start" />
              )}
              {actionLabel}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
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
        "rounded-xl border bg-secondary p-3 text-sm leading-6",
        tone === "danger" ? "border-destructive/35" : undefined,
      )}
    >
      <p className="font-medium text-foreground">{label}</p>
      <p className="mt-1 text-muted-foreground">{children}</p>
    </div>
  );
}

function getAccountSettingsToastMessage(
  result: AccountSettingsSubmissionResult | undefined,
) {
  if (isAccountSuccessResult(result)) {
    return getSuccessMessage(result.status);
  }

  return getFormError(result);
}

function isAccountSuccessResult(
  result: AccountSettingsSubmissionResult | undefined,
): result is AccountSettingsSuccessResult {
  return (
    result?.status === "deactivated" ||
    result?.status === "reactivated" ||
    result?.status === "deletion_requested" ||
    result?.status === "deletion_cancelled"
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

function getConfirmationTokenError(
  intent: Extract<AccountAction, "deactivate" | "request_deletion">,
) {
  if (intent === "deactivate") {
    return "Type DEACTIVATE to deactivate your profile.";
  }

  return "Type DELETE to request account deletion.";
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
