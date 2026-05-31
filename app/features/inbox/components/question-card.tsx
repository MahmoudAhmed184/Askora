import { PencilLine, RotateCcw, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useFetcher } from "react-router";

import { Button } from "~/components/ui/button";
import { QuestionModerationControls } from "~/features/inbox/components/question-moderation-controls";
import type { InboxActionResult } from "~/features/inbox/inbox-actions.server";
import type { InboxQuestionView } from "~/features/inbox/inbox.loader.server";

interface QuestionCardProps {
  question: InboxQuestionView;
  disabled: boolean;
}

interface InboxFetcherData {
  inbox: InboxActionResult;
}

type InboxFetcher = ReturnType<typeof useFetcher<InboxFetcherData>>;
type InboxActionSuccessStatus = Exclude<
  InboxActionResult["status"],
  "invalid" | "denied"
>;

export function QuestionCard({ question, disabled }: QuestionCardProps) {
  return (
    <QuestionCardFrame
      disabled={disabled}
      question={question}
      restoreAction={false}
    />
  );
}

export function FilteredQuestionCard({ question, disabled }: QuestionCardProps) {
  return (
    <QuestionCardFrame
      disabled={disabled}
      question={question}
      restoreAction={true}
    />
  );
}

function QuestionCardFrame({
  disabled,
  question,
  restoreAction,
}: QuestionCardProps & { restoreAction: boolean }) {
  const fetcher = useFetcher<InboxFetcherData>();
  const isPending = fetcher.state !== "idle";
  const result = fetcher.data?.inbox;

  return (
    <article className="flex flex-col gap-4 rounded-lg border bg-card p-5 text-card-foreground shadow-sm">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>{question.identity === "attributed" ? "Attributed" : "Anonymous"}</span>
          <span aria-hidden="true">/</span>
          <time dateTime={question.createdAt}>
            {formatQuestionCreatedAt(question.createdAt)}
          </time>
        </div>
      </header>

      <p className="whitespace-pre-wrap break-words text-base leading-7">
        {question.text}
      </p>

      {result === undefined ? undefined : <ActionResultMessage result={result} />}

      <div className="flex flex-wrap items-center gap-2">
        {!restoreAction && !disabled && !isPending ? (
          <Button asChild size="sm">
            <Link to={`/dashboard/answer/${question.publicId}`}>
              <PencilLine data-icon="inline-start" />
              Answer
            </Link>
          </Button>
        ) : !restoreAction ? (
          <Button disabled size="sm">
            <PencilLine data-icon="inline-start" />
            Answer
          </Button>
        ) : undefined}

        {restoreAction ? (
          <InlineActionForm
            disabled={disabled || isPending}
            fetcher={fetcher}
            icon={<RotateCcw data-icon="inline-start" />}
            intent="restore"
            label="Restore"
            questionPublicId={question.publicId}
          />
        ) : undefined}

        <InlineActionForm
          disabled={disabled || isPending}
          fetcher={fetcher}
          icon={<Trash2 data-icon="inline-start" />}
          intent="delete"
          label="Delete"
          questionPublicId={question.publicId}
          variant="outline"
        />

        <QuestionModerationControls
          disabled={disabled || isPending}
          questionPublicId={question.publicId}
        />
      </div>
    </article>
  );
}

function InlineActionForm({
  disabled,
  fetcher,
  icon,
  intent,
  label,
  questionPublicId,
  variant = "default",
}: {
  disabled: boolean;
  fetcher: InboxFetcher;
  icon: ReactNode;
  intent: "delete" | "restore" | "block";
  label: string;
  questionPublicId: string;
  variant?: "default" | "outline";
}) {
  return (
    <fetcher.Form method="post">
      <input name="intent" type="hidden" value={intent} />
      <input name="questionPublicId" type="hidden" value={questionPublicId} />
      <Button disabled={disabled} size="sm" type="submit" variant={variant}>
        {icon}
        {label}
      </Button>
    </fetcher.Form>
  );
}

function ActionResultMessage({ result }: { result: InboxActionResult }) {
  if (result.status === "invalid" || result.status === "denied") {
    return (
      <p className="text-sm leading-6 text-destructive" role="alert">
        {result.formError}
      </p>
    );
  }

  return (
    <p className="text-sm leading-6 text-muted-foreground" role="status">
      {getSuccessMessage(result.status)}
    </p>
  );
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

function formatQuestionCreatedAt(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
