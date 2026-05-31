import {
  EyeOff,
  Pin,
  PinOff,
  Save,
  Settings2,
  Trash2,
} from "lucide-react";
import type { ReactNode } from "react";
import { useFetcher } from "react-router";

import { Button } from "~/components/ui/button";
import { buttonVariants } from "~/components/ui/button-variants";
import { Textarea } from "~/components/ui/textarea";
import type { PublishedAnswerActionIntent } from "~/features/answers/answer.schema";
import type { PublishedAnswerActionResult } from "~/features/answers/manage-published-answer.server";
import type { PublishedAnswerControlState } from "~/features/answers/published-answer-controls";
import { cn } from "~/lib/utils";

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

export function PublishedAnswerOwnerControls({
  answer,
  controls,
}: PublishedAnswerOwnerControlsProps) {
  const fetcher = useFetcher<PublishedAnswerActionFetcherData>();
  const disabled = controls.disabled || fetcher.state !== "idle";
  const action = `/dashboard/answers/${answer.publicId}/actions`;
  const result = fetcher.data?.publishedAnswer;

  return (
    <details className="group self-start">
      <summary
        aria-disabled={controls.disabled ? true : undefined}
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "list-none marker:hidden",
        )}
      >
        <Settings2 data-icon="inline-start" />
        Manage
      </summary>
      <div className="mt-3 flex w-full min-w-64 max-w-xl flex-col gap-3 rounded-md border bg-surface p-3">
        {result === undefined ? undefined : (
          <PublishedAnswerActionMessage result={result} />
        )}

        <fetcher.Form
          action={action}
          aria-label="Edit published answer"
          className="flex flex-col gap-2"
          method="post"
        >
          <input name="intent" type="hidden" value="edit" />
          <label
            className="flex flex-col gap-2 text-sm font-medium"
            htmlFor={`answerText-${answer.publicId}`}
          >
            Edit answer
            <Textarea
              defaultValue={answer.answerText}
              disabled={disabled}
              id={`answerText-${answer.publicId}`}
              maxLength={3_000}
              name="answerText"
              rows={5}
            />
          </label>
          <Button disabled={disabled} size="sm" type="submit">
            <Save data-icon="inline-start" />
            Save
          </Button>
        </fetcher.Form>

        <div className="flex flex-wrap items-center gap-2">
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
              variant="outline"
            />
          )}

          <InlinePublishedAnswerActionForm
            action={action}
            disabled={disabled}
            fetcher={fetcher}
            icon={<EyeOff data-icon="inline-start" />}
            intent="unpublish"
            label="Unpublish"
            variant="outline"
          />

          <InlinePublishedAnswerActionForm
            action={action}
            disabled={disabled}
            fetcher={fetcher}
            icon={<Trash2 data-icon="inline-start" />}
            intent="delete"
            label="Delete"
            variant="destructive"
          />
        </div>
      </div>
    </details>
  );
}

function InlinePublishedAnswerActionForm({
  action,
  disabled,
  fetcher,
  icon,
  intent,
  label,
  variant = "default",
}: {
  action: string;
  disabled: boolean;
  fetcher: PublishedAnswerActionFetcher;
  icon: ReactNode;
  intent: Exclude<PublishedAnswerActionIntent, "edit">;
  label: string;
  variant?: "default" | "destructive" | "outline";
}) {
  return (
    <fetcher.Form action={action} method="post">
      <input name="intent" type="hidden" value={intent} />
      <Button disabled={disabled} size="sm" type="submit" variant={variant}>
        {icon}
        {label}
      </Button>
    </fetcher.Form>
  );
}

function PublishedAnswerActionMessage({
  result,
}: {
  result: PublishedAnswerActionResult;
}) {
  if (result.status !== "invalid" && result.status !== "denied") {
    return null;
  }

  return (
    <p className="text-sm leading-6 text-destructive" role="alert">
      {result.formError}
    </p>
  );
}
