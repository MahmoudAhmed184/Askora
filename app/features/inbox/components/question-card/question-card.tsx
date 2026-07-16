import { PencilLine, RotateCcw, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useFetcher, useLocation } from "react-router";

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
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog/alert-dialog";
import { Button } from "~/components/ui/button/button";
import { buttonVariants } from "~/components/ui/button/button-variants";
import { QuestionModerationControls } from "~/features/inbox/components/question-moderation-controls";
import type { InboxActionResult } from "~/features/inbox/types/inbox.types";
import type { InboxQuestionView } from "~/features/inbox/types/inbox.types";
import { createAnswerModalLink } from "~/features/answers/answer-modal";
import { formatMediumDateTime } from "~/lib/date-format";

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
  const location = useLocation();
  const isPending = fetcher.state !== "idle";
  const result = fetcher.data?.inbox;
  const answerHref = createAnswerHref({
    location,
    questionPublicId: question.publicId,
  });

  return (
    <article className="flex flex-col gap-6 rounded-3xl border bg-card p-6 text-card-foreground shadow-[var(--shadow-card)] transition-[border-color] duration-[250ms] ease-[ease] hover:border-border-strong sm:p-8">
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-muted-foreground">
          <span className="rounded-full border bg-secondary px-3 py-1 font-semibold text-foreground">
            {question.identity === "attributed" ? "Attributed" : "Anonymous"}
          </span>
          <time dateTime={question.createdAt}>
            {formatQuestionCreatedAt(question.createdAt)}
          </time>
        </div>
        <QuestionModerationControls
          disabled={disabled || isPending}
          questionPublicId={question.publicId}
        />
      </header>

      <p className="whitespace-pre-wrap break-words font-serif text-2xl font-bold italic leading-tight text-foreground">
        {question.text}
      </p>

      <ActionResultToast result={result} />

      <div className="grid gap-3 sm:grid-cols-2">
        {!restoreAction && !disabled && !isPending ? (
          <Button asChild className="w-full" size="sm">
            <Link
              defaultShouldRevalidate={false}
              id={answerHref.focusReturnId}
              mask={answerHref.mask}
              preventScrollReset
              to={answerHref.to}
            >
              <PencilLine data-icon="inline-start" />
              Answer question
            </Link>
          </Button>
        ) : !restoreAction ? (
          <Button className="w-full" disabled size="sm">
            <PencilLine data-icon="inline-start" />
            Answer question
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

        <DeleteQuestionAction
          disabled={disabled || isPending}
          fetcher={fetcher}
          label={restoreAction ? "Delete" : "Drop"}
          questionPublicId={question.publicId}
        />
      </div>
    </article>
  );
}

function DeleteQuestionAction({
  disabled,
  fetcher,
  label,
  questionPublicId,
}: {
  disabled: boolean;
  fetcher: InboxFetcher;
  label: string;
  questionPublicId: string;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          aria-label="Delete question"
          className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
          disabled={disabled}
          size="sm"
          type="button"
          variant="ghost"
        >
          <Trash2 data-icon="inline-start" />
          {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this question?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes the question. It cannot be answered or
            restored afterwards.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className={buttonVariants({ variant: "destructive" })}
            onClick={() => {
              submitDeleteQuestion({ fetcher, questionPublicId });
            }}
          >
            {label}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function submitDeleteQuestion({
  fetcher,
  questionPublicId,
}: {
  fetcher: InboxFetcher;
  questionPublicId: string;
}) {
  const formData = new FormData();

  formData.set("intent", "delete");
  formData.set("questionPublicId", questionPublicId);

  void fetcher.submit(formData, { method: "post" });
}

function InlineActionForm({
  disabled,
  fetcher,
  icon,
  intent,
  label,
  questionPublicId,
}: {
  disabled: boolean;
  fetcher: InboxFetcher;
  icon: ReactNode;
  intent: "restore" | "block";
  label: string;
  questionPublicId: string;
}) {
  return (
    <fetcher.Form method="post">
      <input name="intent" type="hidden" value={intent} />
      <input name="questionPublicId" type="hidden" value={questionPublicId} />
      <Button
        className="w-full"
        disabled={disabled}
        size="sm"
        type="submit"
        variant="default"
      >
        {icon}
        {label}
      </Button>
    </fetcher.Form>
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

function formatQuestionCreatedAt(value: string) {
  return formatMediumDateTime(value);
}

function createAnswerHref({
  location,
  questionPublicId,
}: {
  location: {
    hash: string;
    pathname: string;
    search: string;
  };
  questionPublicId: string;
}) {
  return createAnswerModalLink({ location, questionPublicId });
}
