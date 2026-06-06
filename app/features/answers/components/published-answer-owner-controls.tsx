import {
  EyeOff,
  MoreHorizontal,
  Pin,
  PinOff,
  Save,
  Trash2,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { useFetcher } from "react-router";

import { ActionToast } from "~/components/app/action-toast";
import { ToastResultInput } from "~/components/app/toast-result-input";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Textarea } from "~/components/ui/textarea";
import type { PublishedAnswerActionIntent } from "~/features/answers/answer.schema";
import type { PublishedAnswerActionResult } from "~/features/answers/manage-published-answer.server";
import type { PublishedAnswerControlState } from "~/features/answers/published-answer-controls";

export interface PublishedAnswerOwnerControlAnswer {
  publicId: string;
  answerText: string;
  pinPosition: number | null;
}

interface PublishedAnswerOwnerControlsProps {
  answer: PublishedAnswerOwnerControlAnswer;
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

export function PublishedAnswerOwnerControls({
  answer,
  controls,
}: PublishedAnswerOwnerControlsProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmIntent, setConfirmIntent] = useState<ConfirmIntent | null>(null);
  const fetcher = useFetcher<PublishedAnswerActionFetcherData>();
  const disabled = controls.disabled || fetcher.state !== "idle";
  const action = `/dashboard/answers/${answer.publicId}/actions`;
  const result = fetcher.data?.publishedAnswer;

  return (
    <div className="relative self-start">
      <PublishedAnswerActionToast result={result} />
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label="Manage published answer"
            disabled={disabled}
            size="icon"
            type="button"
            variant="ghost"
          >
            <MoreHorizontal data-icon="inline-start" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56" side="top">
          <DropdownMenuLabel>Answer controls</DropdownMenuLabel>
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
        </DropdownMenuContent>
      </DropdownMenu>

      {editOpen ? (
        <EditPublishedAnswerPanel
          action={action}
          answer={answer}
          disabled={disabled}
          fetcher={fetcher}
          onClose={() => {
            setEditOpen(false);
          }}
        />
      ) : undefined}

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

function EditPublishedAnswerPanel({
  action,
  answer,
  disabled,
  fetcher,
  onClose,
}: {
  action: string;
  answer: PublishedAnswerOwnerControlAnswer;
  disabled: boolean;
  fetcher: PublishedAnswerActionFetcher;
  onClose: () => void;
}) {
  return (
    <div
      aria-label="Edit published answer"
      className="fixed inset-x-4 bottom-24 z-50 mx-auto flex max-h-[min(34rem,calc(100vh-7rem))] max-w-md flex-col gap-3 overflow-auto rounded-2xl border bg-card p-4 text-card-foreground shadow-[var(--shadow-card-hover)] sm:inset-x-auto sm:left-1/2 sm:w-[28rem] sm:-translate-x-1/2"
      role="dialog"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold">Silent edit</h3>
          <p className="text-sm leading-6 text-muted-foreground">
            Update the answer without notifying followers or thread participants.
          </p>
        </div>
        <Button
          aria-label="Close edit published answer"
          disabled={disabled}
          onClick={onClose}
          size="icon"
          type="button"
          variant="ghost"
        >
          <X data-icon="inline-start" />
        </Button>
      </div>

      <fetcher.Form
        action={action}
        aria-label="Edit published answer"
        className="flex flex-col gap-3"
        method="post"
        onSubmit={onClose}
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
        <div className="flex flex-wrap items-center gap-2">
          <Button disabled={disabled} size="sm" type="submit">
            <Save data-icon="inline-start" />
            Save answer
          </Button>
          <Button
            disabled={disabled}
            onClick={onClose}
            size="sm"
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
        </div>
      </fetcher.Form>
    </div>
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
  const copy =
    intent === "delete"
      ? {
          description:
            "This removes the public answer and leaves a compact removed state where the thread order needs to be preserved.",
          label: "Delete answer",
          title: "Delete answer?",
        }
      : {
          description:
            "This removes the answer from public profile, feed, and thread surfaces without creating a new notification.",
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
            <input name="intent" type="hidden" value={intent ?? "delete"} />
            <AlertDialogAction
              asChild
              className={buttonVariants({
                variant: intent === "delete" ? "destructive" : "default",
              })}
            >
              <Button
                disabled={disabled}
                type="submit"
                variant={intent === "delete" ? "destructive" : "default"}
              >
                {intent === "delete" ? (
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
