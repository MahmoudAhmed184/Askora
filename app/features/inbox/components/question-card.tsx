import {
  Ban,
  Flag,
  RotateCcw,
  Send,
  Trash2,
} from "lucide-react";
import type { ReactNode } from "react";
import { useFetcher } from "react-router";

import { Button } from "~/components/ui/button";
import { buttonVariants } from "~/components/ui/button-variants";
import { Textarea } from "~/components/ui/textarea";
import type { InboxActionResult } from "~/features/inbox/inbox-actions.server";
import type { InboxQuestionView } from "~/features/inbox/inbox.loader.server";
import {
  reportReasonValues,
  type ReportReason,
} from "~/features/inbox/inbox.schema";
import { cn } from "~/lib/utils";

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
} as const satisfies Record<ReportReason, string>;

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

        <InlineActionForm
          disabled={disabled || isPending}
          fetcher={fetcher}
          icon={<Ban data-icon="inline-start" />}
          intent="block"
          label="Block sender"
          questionPublicId={question.publicId}
          variant="outline"
        />

        <details className="group">
          <summary
            aria-disabled={disabled || isPending}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "list-none marker:hidden",
              disabled || isPending ? "pointer-events-none opacity-50" : "",
            )}
          >
            <Flag data-icon="inline-start" />
            Report
          </summary>
          <fetcher.Form
            aria-label="Report question"
            className="mt-3 flex w-full min-w-64 max-w-md flex-col gap-3 rounded-md border bg-surface p-3"
            method="post"
          >
            <input name="intent" type="hidden" value="report" />
            <input
              name="questionPublicId"
              type="hidden"
              value={question.publicId}
            />
            <label className="flex flex-col gap-2 text-sm font-medium">
              Reason
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30"
                defaultValue=""
                disabled={disabled || isPending}
                name="reason"
                required
              >
                <option disabled value="">
                  Choose a reason
                </option>
                {reportReasonValues.map((reason) => (
                  <option key={reason} value={reason}>
                    {reportReasonLabels[reason]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">
              Details
              <Textarea
                disabled={disabled || isPending}
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
                disabled={disabled || isPending}
                name="alsoBlockSender"
                type="checkbox"
              />
              Also block sender
            </label>
            <Button disabled={disabled || isPending} size="sm" type="submit">
              <Send data-icon="inline-start" />
              Submit report
            </Button>
          </fetcher.Form>
        </details>
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
