import { ShieldCheck } from "lucide-react";
import { useId, useRef, useState } from "react";
import { Form, useNavigation } from "react-router";

import { ActionToast } from "~/components/shared/action-toast/action-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog/alert-dialog";
import { Button } from "~/components/ui/button/button";
import { buttonVariants } from "~/components/ui/button/button-variants";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card/card";
import {
  Field,
  FieldError,
  FieldLabel,
} from "~/components/ui/field/field";
import { Select } from "~/components/ui/select/select";
import { Textarea } from "~/components/ui/textarea/textarea";
import type { AdminActionType } from "~/features/admin/validations/admin.validations";
import { requiresAdminActionNotes } from "~/features/admin/validations/admin.validations";
import type { AdminReportActionResult } from "~/features/admin/types/admin.types";
import { adminActionLabels } from "~/features/admin/components/admin-labels";

interface AdminActionFormProps {
  actionResult: AdminReportActionResult | undefined;
  availableActions: AdminActionType[];
}

export function AdminActionForm({
  actionResult,
  availableActions,
}: AdminActionFormProps) {
  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const confirmedSubmitRef = useRef(false);
  const [selectedAction, setSelectedAction] = useState<AdminActionType>(
    getInitialActionType({ actionResult, availableActions }),
  );
  const [notes, setNotes] = useState(getInitialNotes(actionResult));
  const [confirmAction, setConfirmAction] = useState<AdminActionType | null>(null);
  const [clientNotesError, setClientNotesError] = useState<string | null>(null);
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const fieldErrors =
    actionResult?.status === "invalid" ? actionResult.fieldErrors : {};
  const selectedActionRequiresNotes = requiresAdminActionNotes(selectedAction);
  const notesError = clientNotesError ?? fieldErrors.notes;
  const actionToast = getAdminActionToast(actionResult);

  return (
    <Card>
      <ActionToast
        message={actionToast?.message}
        tone={actionToast?.tone ?? "info"}
        trigger={actionResult}
      />
      <CardHeader>
        <CardTitle className="text-base">Moderation action</CardTitle>
        <CardDescription>
          Actions are audited and applied transactionally.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form
          className="flex flex-col gap-4"
          id={formId}
          method="post"
          onSubmit={(event) => {
            if (confirmedSubmitRef.current) {
              confirmedSubmitRef.current = false;
              return;
            }

            if (!requiresAdminActionConfirmation(selectedAction)) {
              return;
            }

            if (selectedActionRequiresNotes && notes.trim().length === 0) {
              event.preventDefault();
              setClientNotesError("Notes are required for this action.");
              return;
            }

            event.preventDefault();
            setConfirmAction(selectedAction);
          }}
          ref={formRef}
        >
          <Field data-invalid={fieldErrors.actionType !== undefined ? true : undefined}>
            <FieldLabel htmlFor="actionType">Action</FieldLabel>
            <Select
              aria-describedby="actionType-error"
              aria-invalid={fieldErrors.actionType === undefined ? undefined : true}
              id="actionType"
              name="actionType"
              onChange={(event) => {
                const nextAction = event.currentTarget.value as AdminActionType;
                setSelectedAction(nextAction);
                if (!requiresAdminActionNotes(nextAction)) {
                  setClientNotesError(null);
                }
              }}
              value={selectedAction}
            >
              {availableActions.map((action) => (
                <option key={action} value={action}>
                  {adminActionLabels[action]}
                  {requiresAdminActionNotes(action) ? " *" : ""}
                </option>
              ))}
            </Select>
            <FieldError id="actionType-error" message={fieldErrors.actionType} />
          </Field>

          <Field data-invalid={notesError !== undefined ? true : undefined}>
            <FieldLabel htmlFor="notes">Notes</FieldLabel>
            <Textarea
              aria-describedby="notes-error"
              aria-invalid={notesError === undefined ? undefined : true}
              id="notes"
              name="notes"
              onChange={(event) => {
                setNotes(event.currentTarget.value);
                setClientNotesError(null);
              }}
              placeholder="Internal moderation note"
              value={notes}
            />
            <FieldError id="notes-error" message={notesError} />
          </Field>

          <Button className="w-fit gap-2" disabled={isSubmitting} type="submit">
            <ShieldCheck data-icon="inline-start" />
            {isSubmitting ? "Applying" : "Apply action"}
          </Button>
        </Form>

        <ConfirmAdminActionDialog
          actionType={confirmAction}
          disabled={isSubmitting}
          onConfirm={() => {
            confirmedSubmitRef.current = true;
            formRef.current?.requestSubmit();
          }}
          onOpenChange={(open) => {
            if (!open) {
              setConfirmAction(null);
            }
          }}
        />
      </CardContent>
    </Card>
  );
}

function getAdminActionToast(result: AdminReportActionResult | undefined):
  | {
      message: string;
      tone: "error" | "success";
    }
  | undefined {
  if (result === undefined) {
    return undefined;
  }

  if (result.status === "invalid" || result.status === "denied") {
    return {
      message: result.formError,
      tone: "error",
    };
  }

  return {
    message: `${adminActionLabels[result.actionType]} applied.`,
    tone: "success",
  };
}

function ConfirmAdminActionDialog({
  actionType,
  disabled,
  onConfirm,
  onOpenChange,
}: {
  actionType: AdminActionType | null;
  disabled: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  const label =
    actionType === null ? "Apply action" : adminActionLabels[actionType];
  const destructive =
    actionType === "permanent_suspension" ||
    actionType === "hide_profile" ||
    actionType === "remove_public_content";

  return (
    <AlertDialog open={actionType !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{label}?</AlertDialogTitle>
          <AlertDialogDescription>
            This will update the report, write an audit record, and apply the
            selected moderation change to the target.
          </AlertDialogDescription>
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
              <ShieldCheck data-icon="inline-start" />
              Apply {label}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function getInitialActionType({
  actionResult,
  availableActions,
}: AdminActionFormProps) {
  if (
    (actionResult?.status === "invalid" || actionResult?.status === "denied") &&
    availableActions.includes(actionResult.values.actionType as AdminActionType)
  ) {
    return actionResult.values.actionType as AdminActionType;
  }

  return availableActions[0] ?? "dismiss";
}

function getInitialNotes(actionResult: AdminReportActionResult | undefined) {
  if (actionResult?.status === "invalid" || actionResult?.status === "denied") {
    return actionResult.values.notes;
  }

  return "";
}

function requiresAdminActionConfirmation(actionType: AdminActionType) {
  return (
    actionType === "suspend_7_days" ||
    actionType === "suspend_30_days" ||
    actionType === "permanent_suspension" ||
    actionType === "hide_profile" ||
    actionType === "remove_public_content"
  );
}
