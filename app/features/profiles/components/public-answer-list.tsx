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

import { EmptyState } from "~/components/app/empty-state";
import { Button } from "~/components/ui/button";
import { buttonVariants } from "~/components/ui/button-variants";
import { Textarea } from "~/components/ui/textarea";
import type { PublicPublishedAnswer } from "~/features/answers/answer.server";
import type { PublishedAnswerActionIntent } from "~/features/answers/answer.schema";
import type { PublishedAnswerActionResult } from "~/features/answers/manage-published-answer.server";
import type { PublishedAnswerControlState } from "~/features/profiles/profile.loader.server";
import { cn } from "~/lib/utils";

interface PublicAnswerListProps {
  answers: PublicPublishedAnswer[];
  controls?: PublishedAnswerControlState;
}

interface PublishedAnswerActionFetcherData {
  publishedAnswer: PublishedAnswerActionResult;
}

type PublishedAnswerActionFetcher = ReturnType<
  typeof useFetcher<PublishedAnswerActionFetcherData>
>;

export function PublicAnswerList({
  answers,
  controls = hiddenPublishedAnswerControls,
}: PublicAnswerListProps) {
  if (answers.length === 0) {
    return (
      <section
        aria-labelledby="published-answers-title"
        className="pt-2"
        id="published-answers"
      >
        <h2 className="sr-only" id="published-answers-title">
          Published answers
        </h2>
        <EmptyState
          description="Answered questions will appear here once this profile publishes them."
          title="No public answers yet"
        />
      </section>
    );
  }

  return (
    <section
      aria-labelledby="published-answers-title"
      className="flex flex-col gap-3 pt-2"
      id="published-answers"
    >
      <h2 className="text-lg font-semibold" id="published-answers-title">
        Published answers
      </h2>
      <div className="flex flex-col gap-3">
        {answers.map((answer) => (
          <PublicAnswerArticle
            answer={answer}
            controls={controls}
            key={answer.publicId}
          />
        ))}
      </div>
    </section>
  );
}

function PublicAnswerArticle({
  answer,
  controls,
}: {
  answer: PublicPublishedAnswer;
  controls: PublishedAnswerControlState;
}) {
  return (
    <article className="flex flex-col gap-4 rounded-lg border bg-card p-5 text-card-foreground shadow-sm">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {answer.pinPosition === null ? undefined : (
            <span className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium text-foreground">
              <Pin aria-hidden="true" className="size-3" />
              Pinned {answer.pinPosition}
            </span>
          )}
          <time dateTime={answer.publishedAt}>
            {formatDate(answer.publishedAt)}
          </time>
        </div>

        {controls.canManage ? (
          <PublishedAnswerOwnerControls answer={answer} controls={controls} />
        ) : undefined}
      </header>

      {answer.questionTextMode === "hidden" ||
      answer.questionText === null ? undefined : (
        <div className="flex flex-col gap-2 border-b pb-4">
          <p className="whitespace-pre-wrap break-words text-base font-medium leading-7">
            {answer.questionText}
          </p>
          {answer.asker === undefined ? undefined : (
            <p className="text-sm leading-6 text-muted-foreground">
              Asked by{" "}
              <span className="font-medium text-foreground">
                {answer.asker.displayName}
              </span>{" "}
              @{answer.asker.username}
            </p>
          )}
        </div>
      )}

      <p className="whitespace-pre-wrap break-words text-base leading-7">
        {answer.answerText}
      </p>
    </article>
  );
}

function PublishedAnswerOwnerControls({
  answer,
  controls,
}: {
  answer: PublicPublishedAnswer;
  controls: PublishedAnswerControlState;
}) {
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

const hiddenPublishedAnswerControls = {
  canManage: false,
  disabled: false,
} satisfies PublishedAnswerControlState;
