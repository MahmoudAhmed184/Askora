import {
  Ban,
  Flag,
  LoaderCircle,
  MoreHorizontal,
  Send,
  Trash2,
} from "lucide-react";
import { useId, useState } from "react";
import { useFetcher } from "react-router";

import { ActionToast } from "~/components/shared/action-toast/action-toast";
import { Button } from "~/components/ui/button/button";
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
import { buttonVariants } from "~/components/ui/button/button-variants";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu/dropdown-menu";
import { Field, FieldLabel } from "~/components/ui/field/field";
import { Select } from "~/components/ui/select/select";
import { Textarea } from "~/components/ui/textarea/textarea";
import {
  moderationReportReasonValues,
  type ModerationReportReason,
} from "~/db/schema/moderation-values";
import type { InboxActionResult } from "~/features/inbox/types/inbox.types";

interface QuestionModerationControlsProps {
  questionPublicId: string;
  disabled: boolean;
  action?: string | undefined;
  canDelete?: boolean | undefined;
  deleteLabel?: "Delete" | "Drop" | undefined;
  variant?: "menu" | "inline";
}

interface InboxFetcherData {
  inbox: InboxActionResult;
}

type InboxFetcher = ReturnType<typeof useFetcher<InboxFetcherData>>;
type InboxActionSuccessStatus = Exclude<
  InboxActionResult["status"],
  "invalid" | "denied"
>;
type ActivePanel = "menu" | "report" | "block" | "delete" | null;

const reportReasonLabels = {
  harassment: "Harassment or bullying",
  hate: "Hate",
  threats: "Threats or violence",
  sexual_content: "Sexual content",
  self_harm: "Self-harm",
  private_information: "Private information",
  impersonation: "Impersonation",
  spam_scam: "Spam or scam",
  other: "Other",
} as const satisfies Record<ModerationReportReason, string>;

export function QuestionModerationControls({
  action,
  canDelete = false,
  deleteLabel = "Delete",
  disabled,
  questionPublicId,
  variant = "menu",
}: QuestionModerationControlsProps) {
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const fetcher = useFetcher<InboxFetcherData>();
  const isPending = fetcher.state !== "idle";
  const result = fetcher.data?.inbox;
  const actionProps = getActionProps(action);

  return (
    <div>
      {variant === "inline" ? (
        <InlineActions
          disabled={disabled || isPending}
          onBlock={() => {
            setActivePanel("block");
          }}
          onReport={() => {
            setActivePanel("report");
          }}
        />
      ) : (
        <QuestionActionsMenu
          disabled={disabled || isPending}
          canDelete={canDelete}
          deleteLabel={deleteLabel}
          open={activePanel === "menu"}
          onBlock={() => {
            setActivePanel("block");
          }}
          onOpenChange={(open) => {
            setActivePanel((current) => {
              if (open) {
                return "menu";
              }

              return current === "menu" ? null : current;
            });
          }}
          onReport={() => {
            setActivePanel("report");
          }}
          onDelete={() => {
            setActivePanel("delete");
          }}
        />
      )}

      <ReportDialog
        actionProps={actionProps}
        disabled={disabled}
        fetcher={fetcher}
        isPending={isPending}
        onOpenChange={(open) => {
          setActivePanel(open ? "report" : null);
        }}
        open={activePanel === "report"}
        questionPublicId={questionPublicId}
      />

      <BlockDialog
        actionProps={actionProps}
        disabled={disabled}
        fetcher={fetcher}
        isPending={isPending}
        onOpenChange={(open) => {
          setActivePanel(open ? "block" : null);
        }}
        open={activePanel === "block"}
        questionPublicId={questionPublicId}
      />

      {canDelete ? (
        <DeleteDialog
          actionProps={actionProps}
          disabled={disabled}
          fetcher={fetcher}
          isPending={isPending}
          label={deleteLabel}
          onOpenChange={(open) => {
            setActivePanel(open ? "delete" : null);
          }}
          open={activePanel === "delete"}
          questionPublicId={questionPublicId}
        />
      ) : null}

      <QuestionModerationNoScriptFallback
        action={action}
        disabled={disabled}
        questionPublicId={questionPublicId}
      />

      <ActionResultToast result={result} />
    </div>
  );
}

export function QuestionModerationNoScriptFallback({
  action,
  disabled,
  questionPublicId,
}: Pick<
  QuestionModerationControlsProps,
  "action" | "disabled" | "questionPublicId"
>) {
  return (
    <noscript>
      <details className="mt-3 rounded-xl border bg-secondary p-4">
        <summary className="cursor-pointer font-bold">Safety actions</summary>
        <div className="mt-4 flex flex-col gap-5">
          <form action={action} className="flex flex-col gap-3" method="post">
            <input name="intent" type="hidden" value="report" />
            <input
              name="questionPublicId"
              type="hidden"
              value={questionPublicId}
            />
            <label className="flex flex-col gap-2 text-sm font-bold">
              Reason
              <Select
                defaultValue=""
                disabled={disabled}
                name="reason"
                required
              >
                <option disabled value="">
                  Choose a reason
                </option>
                {moderationReportReasonValues.map((reason) => (
                  <option key={reason} value={reason}>
                    {reportReasonLabels[reason]}
                  </option>
                ))}
              </Select>
            </label>
            <label className="flex flex-col gap-2 text-sm font-bold">
              Details
              <Textarea
                disabled={disabled}
                maxLength={500}
                name="details"
                placeholder="Optional context for moderators"
                rows={3}
              />
            </label>
            <label className="flex items-start gap-2 text-sm leading-6 text-muted-foreground">
              <input
                className="mt-1 size-4 accent-primary"
                defaultChecked
                disabled={disabled}
                name="alsoBlockSender"
                type="checkbox"
              />
              Also block sender
            </label>
            <Button disabled={disabled} type="submit">
              <Flag data-icon="inline-start" />
              Submit report
            </Button>
          </form>

          <form action={action} className="flex flex-col gap-2" method="post">
            <input name="intent" type="hidden" value="block" />
            <input
              name="questionPublicId"
              type="hidden"
              value={questionPublicId}
            />
            <p className="text-sm leading-6 text-muted-foreground">
              Blocking silently sends future questions from this sender through
              the safety filter.
            </p>
            <Button disabled={disabled} type="submit" variant="destructive">
              <Ban data-icon="inline-start" />
              Block sender
            </Button>
          </form>
        </div>
      </details>
    </noscript>
  );
}

function InlineActions({
  disabled,
  onBlock,
  onReport,
}: {
  disabled: boolean;
  onBlock: () => void;
  onReport: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        disabled={disabled}
        onClick={onReport}
        type="button"
        variant="outline"
      >
        <Flag data-icon="inline-start" />
        Report
      </Button>
      <Button
        aria-label="Block sender"
        disabled={disabled}
        onClick={onBlock}
        type="button"
        variant="outline"
      >
        <Ban data-icon="inline-start" />
        Block
      </Button>
    </div>
  );
}

function QuestionActionsMenu({
  canDelete,
  deleteLabel,
  disabled,
  onOpenChange,
  open,
  onBlock,
  onDelete,
  onReport,
}: {
  canDelete: boolean;
  deleteLabel: "Delete" | "Drop";
  disabled: boolean;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  onBlock: () => void;
  onDelete: () => void;
  onReport: () => void;
}) {
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label="Question actions"
          disabled={disabled}
          size="icon"
          type="button"
          variant="ghost"
        >
          <MoreHorizontal data-icon="inline-start" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56" side="bottom">
        <DropdownMenuGroup>
          <DropdownMenuItem
            disabled={disabled}
            onSelect={(event) => {
              event.preventDefault();
              onReport();
            }}
          >
            <Flag data-icon="inline-start" />
            Report
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={disabled}
            onSelect={(event) => {
              event.preventDefault();
              onBlock();
            }}
          >
            <Ban data-icon="inline-start" />
            Block sender
          </DropdownMenuItem>
          {canDelete ? (
            <DropdownMenuItem
              disabled={disabled}
              onSelect={(event) => {
                event.preventDefault();
                onDelete();
              }}
              variant="destructive"
            >
              <Trash2 data-icon="inline-start" />
              {deleteLabel}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DeleteDialog({
  actionProps,
  disabled,
  fetcher,
  isPending,
  label,
  onOpenChange,
  open,
  questionPublicId,
}: {
  actionProps: Record<string, string>;
  disabled: boolean;
  fetcher: InboxFetcher;
  isPending: boolean;
  label: "Delete" | "Drop";
  onOpenChange: (open: boolean) => void;
  open: boolean;
  questionPublicId: string;
}) {
  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this question?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes the question. It cannot be answered or
            restored afterwards.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <fetcher.Form
            method="post"
            onSubmit={() => {
              onOpenChange(false);
            }}
            {...actionProps}
          >
            <input name="intent" type="hidden" value="delete" />
            <input
              name="questionPublicId"
              type="hidden"
              value={questionPublicId}
            />
            <AlertDialogAction
              asChild
              className={buttonVariants({ variant: "destructive" })}
            >
              <Button
                disabled={disabled || isPending}
                type="submit"
                variant="destructive"
              >
                <Trash2 data-icon="inline-start" />
                {label}
              </Button>
            </AlertDialogAction>
          </fetcher.Form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function BlockDialog({
  actionProps,
  disabled,
  fetcher,
  isPending,
  onOpenChange,
  open,
  questionPublicId,
}: {
  actionProps: Record<string, string>;
  disabled: boolean;
  fetcher: InboxFetcher;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  questionPublicId: string;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Block sender?</DialogTitle>
          <DialogDescription>
            Future private questions from this sender will be handled by the
            safety filter. They are not notified.
          </DialogDescription>
        </DialogHeader>

        <fetcher.Form
          method="post"
          onSubmit={() => {
            onOpenChange(false);
          }}
          {...actionProps}
        >
          <input name="intent" type="hidden" value="block" />
          <input
            name="questionPublicId"
            type="hidden"
            value={questionPublicId}
          />
          <DialogFooter>
            <Button
              disabled={isPending}
              onClick={() => {
                onOpenChange(false);
              }}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={disabled || isPending}
              type="submit"
              variant="destructive"
            >
              {isPending ? (
                <LoaderCircle
                  className="animate-spin motion-reduce:animate-none"
                  data-icon="inline-start"
                />
              ) : (
                <Ban data-icon="inline-start" />
              )}
              Confirm block
            </Button>
          </DialogFooter>
        </fetcher.Form>
      </DialogContent>
    </Dialog>
  );
}

function ReportDialog({
  actionProps,
  disabled,
  fetcher,
  isPending,
  onOpenChange,
  open,
  questionPublicId,
}: {
  actionProps: Record<string, string>;
  disabled: boolean;
  fetcher: InboxFetcher;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  questionPublicId: string;
}) {
  const reasonId = useId();
  const detailsId = useId();

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Report question</DialogTitle>
          <DialogDescription>
            Reports stay private and are only available for moderation review.
          </DialogDescription>
        </DialogHeader>

        <fetcher.Form
          aria-label="Report question"
          className="flex flex-col gap-4"
          method="post"
          onSubmit={() => {
            onOpenChange(false);
          }}
          {...actionProps}
        >
          <input name="intent" type="hidden" value="report" />
          <input
            name="questionPublicId"
            type="hidden"
            value={questionPublicId}
          />
          <Field>
            <FieldLabel htmlFor={reasonId}>Reason</FieldLabel>
            <Select
              defaultValue=""
              disabled={disabled || isPending}
              id={reasonId}
              name="reason"
              required
            >
              <option disabled value="">
                Choose a reason
              </option>
              {moderationReportReasonValues.map((reason) => (
                <option key={reason} value={reason}>
                  {reportReasonLabels[reason]}
                </option>
              ))}
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor={detailsId}>Details</FieldLabel>
            <Textarea
              disabled={disabled || isPending}
              id={detailsId}
              maxLength={500}
              name="details"
              placeholder="Optional context for moderators"
              rows={3}
            />
          </Field>
          <label className="flex items-start gap-2 text-sm leading-6 text-muted-foreground">
            <input
              className="mt-1 size-4 accent-primary"
              defaultChecked
              disabled={disabled || isPending}
              name="alsoBlockSender"
              type="checkbox"
            />
            Also block sender
          </label>
          <DialogFooter>
            <Button
              disabled={isPending}
              onClick={() => {
                onOpenChange(false);
              }}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={disabled || isPending} type="submit">
              {isPending ? (
                <LoaderCircle
                  className="animate-spin motion-reduce:animate-none"
                  data-icon="inline-start"
                />
              ) : (
                <Send data-icon="inline-start" />
              )}
              Submit report
            </Button>
          </DialogFooter>
        </fetcher.Form>
      </DialogContent>
    </Dialog>
  );
}

function ActionResultToast({
  result,
}: {
  result: InboxActionResult | undefined;
}) {
  return (
    <ActionToast
      message={getActionResultToastMessage(result)}
      tone={
        result?.status === "invalid" || result?.status === "denied"
          ? "error"
          : "success"
      }
      trigger={result}
    />
  );
}

function getActionResultToastMessage(result: InboxActionResult | undefined) {
  if (result === undefined) {
    return undefined;
  }

  if (result.status === "invalid" || result.status === "denied") {
    return result.formError;
  }

  return getSuccessMessage(result.status);
}

function getSuccessMessage(status: InboxActionSuccessStatus) {
  switch (status) {
    case "deleted":
      return "Question deleted.";
    case "restored":
      return "Question restored to inbox.";
    case "blocked":
      return "Sender blocked.";
    case "reported":
      return "Report submitted.";
    case "reported_and_blocked":
      return "Report submitted and sender blocked.";
  }
}

function getActionProps(action: string | undefined) {
  return action === undefined ? {} : { action };
}
