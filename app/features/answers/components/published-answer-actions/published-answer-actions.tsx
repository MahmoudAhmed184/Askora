import {
  EyeOff,
  Flag,
  MoreHorizontal,
  Pin,
  PinOff,
  Save,
  Trash2,
} from "lucide-react";
import type { ReactNode } from "react";
import { useRef, useState } from "react";
import { useFetcher } from "react-router";

import { ActionToast } from "~/components/shared/action-toast/action-toast";
import { ToastResultInput } from "~/components/shared/toast-result/toast-result-input";
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu/dropdown-menu";
import { Textarea } from "~/components/ui/textarea/textarea";
import type { PublishedAnswerActionIntent } from "~/features/answers/validations/answer.validations";
import type { PublishedAnswerActionResult } from "~/features/answers/types/answers.types";
import type { PublishedAnswerControlState } from "~/features/answers/types/answers.types";
import { PublicReportDialog } from "~/features/moderation/components/public-report-dialog";

export interface PublishedAnswerActionAnswer {
  publicId: string;
  answerText: string;
  pinPosition: number | null;
}

interface PublishedAnswerActionsProps {
  answer: PublishedAnswerActionAnswer;
  canReport: boolean;
  controls: PublishedAnswerControlState;
}

interface PublishedAnswerActionFetcherData {
  publishedAnswer: PublishedAnswerActionResult;
}

type PublishedAnswerActionFetcher = ReturnType<
  typeof useFetcher<PublishedAnswerActionFetcherData>
>;
type ConfirmIntent = Extract<
  PublishedAnswerActionIntent,
  "delete" | "unpublish"
>;
type MenuFormIntent = Exclude<
  PublishedAnswerActionIntent,
  "edit" | ConfirmIntent
>;

export function PublishedAnswerActions({
  answer,
  canReport,
  controls,
}: PublishedAnswerActionsProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [confirmIntent, setConfirmIntent] = useState<ConfirmIntent | null>(null);
  const fetcher = useFetcher<PublishedAnswerActionFetcherData>();
  const disabled = controls.disabled || fetcher.state !== "idle";
  const action = `/answers/${answer.publicId}/actions`;
  const result = fetcher.data?.publishedAnswer;

  if (!canReport && !controls.canManage) {
    return null;
  }

  return (
    <div className="relative self-start">
      <PublishedAnswerActionToast result={result} />
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label="Answer actions"
            disabled={disabled}
            size="icon"
            type="button"
            variant="ghost"
          >
            <MoreHorizontal data-icon="inline-start" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          aria-label="Answer actions"
          avoidCollisions={false}
          className="w-56"
          side="top"
        >
          <DropdownMenuLabel>Answer actions</DropdownMenuLabel>
          {canReport ? (
            <DropdownMenuGroup>
              <DropdownMenuItem
                onSelect={() => {
                  setMenuOpen(false);
                  setReportOpen(true);
                }}
              >
                <Flag data-icon="inline-start" />
                Report answer
              </DropdownMenuItem>
            </DropdownMenuGroup>
          ) : null}
          {canReport && controls.canManage ? <DropdownMenuSeparator /> : null}
          {controls.canManage ? (
            <>
              <DropdownMenuGroup>
                <DropdownMenuItem
                  disabled={disabled}
                  onSelect={() => {
                    setMenuOpen(false);
                    setEditOpen(true);
                  }}
                >
                  <Save data-icon="inline-start" />
                  Edit silently
                </DropdownMenuItem>
                {answer.pinPosition === null ? (
                  <InlinePublishedAnswerActionForm
                    action={action}
                    disabled={disabled}
                    fetcher={fetcher}
                    icon={<Pin data-icon="inline-start" />}
                    intent="pin"
                    label="Pin"
                  />
                ) : (
                  <InlinePublishedAnswerActionForm
                    action={action}
                    disabled={disabled}
                    fetcher={fetcher}
                    icon={<PinOff data-icon="inline-start" />}
                    intent="unpin"
                    label="Unpin"
                  />
                )}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem
                  disabled={disabled}
                  onSelect={() => {
                    setMenuOpen(false);
                    setConfirmIntent("unpublish");
                  }}
                >
                  <EyeOff data-icon="inline-start" />
                  Unpublish
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={disabled}
                  onSelect={() => {
                    setMenuOpen(false);
                    setConfirmIntent("delete");
                  }}
                  variant="destructive"
                >
                  <Trash2 data-icon="inline-start" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <PublicReportDialog
        canReport={canReport}
        onOpenChange={setReportOpen}
        open={reportOpen}
        targetId={answer.publicId}
        targetLabel="answer"
        targetType="thread_item"
        trigger="none"
      />

      <EditPublishedAnswerDialog
        action={action}
        answer={answer}
        disabled={disabled}
        fetcher={fetcher}
        onOpenChange={setEditOpen}
        open={editOpen}
      />

      <ConfirmPublishedAnswerActionDialog
        action={action}
        disabled={disabled}
        fetcher={fetcher}
        intent={confirmIntent}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmIntent(null);
          }
        }}
      />
    </div>
  );
}

function EditPublishedAnswerDialog({
  action,
  answer,
  disabled,
  fetcher,
  onOpenChange,
  open,
}: {
  action: string;
  answer: PublishedAnswerActionAnswer;
  disabled: boolean;
  fetcher: PublishedAnswerActionFetcher;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Silent edit</DialogTitle>
          <DialogDescription>
            Update the answer without notifying followers or thread
            participants.
          </DialogDescription>
        </DialogHeader>

        <fetcher.Form
          action={action}
          aria-label="Edit published answer"
          className="flex flex-col gap-4"
          method="post"
          onSubmit={() => {
            onOpenChange(false);
          }}
        >
          <ToastResultInput />
          <input name="intent" type="hidden" value="edit" />
          <label
            className="flex flex-col gap-2 text-sm font-medium"
            htmlFor={`answerText-${answer.publicId}`}
          >
            Answer text
            <Textarea
              defaultValue={answer.answerText}
              disabled={disabled}
              id={`answerText-${answer.publicId}`}
              maxLength={3_000}
              name="answerText"
              rows={6}
            />
          </label>
          <DialogFooter>
            <Button
              disabled={disabled}
              onClick={() => {
                onOpenChange(false);
              }}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={disabled} type="submit">
              <Save data-icon="inline-start" />
              Save answer
            </Button>
          </DialogFooter>
        </fetcher.Form>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmPublishedAnswerActionDialog({
  action,
  disabled,
  fetcher,
  intent,
  onOpenChange,
}: {
  action: string;
  disabled: boolean;
  fetcher: PublishedAnswerActionFetcher;
  intent: ConfirmIntent | null;
  onOpenChange: (open: boolean) => void;
}) {
  const lastIntentRef = useRef<ConfirmIntent>("unpublish");

  if (intent !== null) {
    lastIntentRef.current = intent;
  }

  const activeIntent = intent ?? lastIntentRef.current;
  const copy =
    activeIntent === "delete"
      ? {
          description:
            "This removes the public answer and leaves a compact removed state where the thread order needs to be preserved.",
          label: "Delete answer",
          title: "Delete answer?",
        }
      : {
          description:
            "This moves the answer back to Drafts. If it starts a thread, the entire thread and its follow-ups will be hidden until you publish the answer again.",
          label: "Unpublish answer",
          title: "Unpublish answer?",
        };

  return (
    <AlertDialog open={intent !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.title}</AlertDialogTitle>
          <AlertDialogDescription>{copy.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={disabled}>Cancel</AlertDialogCancel>
          <fetcher.Form
            action={action}
            method="post"
            onSubmit={() => {
              onOpenChange(false);
            }}
          >
            <ToastResultInput />
            <input name="intent" type="hidden" value={activeIntent} />
            <AlertDialogAction
              asChild
              className={buttonVariants({
                variant:
                  activeIntent === "delete" ? "destructive" : "default",
              })}
            >
              <Button
                disabled={disabled}
                type="submit"
                variant={
                  activeIntent === "delete" ? "destructive" : "default"
                }
              >
                {activeIntent === "delete" ? (
                  <Trash2 data-icon="inline-start" />
                ) : (
                  <EyeOff data-icon="inline-start" />
                )}
                {copy.label}
              </Button>
            </AlertDialogAction>
          </fetcher.Form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function InlinePublishedAnswerActionForm({
  action,
  disabled,
  fetcher,
  icon,
  intent,
  label,
}: {
  action: string;
  disabled: boolean;
  fetcher: PublishedAnswerActionFetcher;
  icon: ReactNode;
  intent: MenuFormIntent;
  label: string;
}) {
  return (
    <fetcher.Form action={action} method="post">
      <ToastResultInput />
      <input name="intent" type="hidden" value={intent} />
      <DropdownMenuItem asChild disabled={disabled}>
        <button disabled={disabled} type="submit">
          {icon}
          {label}
        </button>
      </DropdownMenuItem>
    </fetcher.Form>
  );
}

function PublishedAnswerActionToast({
  result,
}: {
  result: PublishedAnswerActionResult | undefined;
}) {
  const toastCopy = getPublishedAnswerToastCopy(result);

  return (
    <ActionToast
      message={toastCopy.message}
      tone={toastCopy.tone}
      trigger={result}
    />
  );
}

function getPublishedAnswerToastCopy(
  result: PublishedAnswerActionResult | undefined,
): {
  message: string | undefined;
  tone: "error" | "success";
} {
  switch (result?.status) {
    case undefined:
      return { message: undefined, tone: "success" };
    case "edited":
      return { message: "Answer updated.", tone: "success" };
    case "pinned":
      return { message: "Answer pinned.", tone: "success" };
    case "unpinned":
      return { message: "Answer unpinned.", tone: "success" };
    case "unpublished":
      return { message: "Answer unpublished.", tone: "success" };
    case "deleted":
      return { message: "Answer deleted.", tone: "success" };
    case "invalid":
    case "denied":
      return { message: result.formError, tone: "error" };
  }
}
