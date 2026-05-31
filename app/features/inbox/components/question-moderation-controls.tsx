import { Ban, Flag, Send, X } from "lucide-react";
import { useId, useState } from "react";
import { useFetcher } from "react-router";

import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import {
  moderationReportReasonValues,
  type ModerationReportReason,
} from "~/db/schema/moderation-values";
import type { InboxActionResult } from "~/features/inbox/inbox-actions.server";

interface QuestionModerationControlsProps {
  questionPublicId: string;
  disabled: boolean;
  action?: string | undefined;
}

interface InboxFetcherData {
  inbox: InboxActionResult;
}

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
} as const satisfies Record<ModerationReportReason, string>;

export function QuestionModerationControls({
  action,
  disabled,
  questionPublicId,
}: QuestionModerationControlsProps) {
  return (
    <>
      <BlockSenderConfirmation
        action={action}
        disabled={disabled}
        questionPublicId={questionPublicId}
      />
      <ReportQuestionDialog
        action={action}
        disabled={disabled}
        questionPublicId={questionPublicId}
      />
    </>
  );
}

export function BlockSenderConfirmation({
  action,
  disabled,
  questionPublicId,
}: QuestionModerationControlsProps) {
  const descriptionId = useId();
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const fetcher = useFetcher<InboxFetcherData>();
  const isPending = fetcher.state !== "idle";
  const result = fetcher.data?.inbox;
  const actionProps = getActionProps(action);

  return (
    <div className="flex flex-col gap-2">
      <Button
        disabled={disabled || isPending}
        onClick={() => {
          setOpen(true);
        }}
        size="sm"
        type="button"
        variant="outline"
      >
        <Ban data-icon="inline-start" />
        Block sender
      </Button>

      {open ? (
        <div
          aria-describedby={descriptionId}
          aria-labelledby={titleId}
          aria-modal="true"
          className="mt-1 flex w-full min-w-64 max-w-md flex-col gap-3 rounded-md border bg-surface p-3 shadow-sm"
          role="dialog"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-semibold" id={titleId}>
                Block sender?
              </h3>
              <p
                className="text-sm leading-6 text-muted-foreground"
                id={descriptionId}
              >
                Future private questions from this sender will be handled by
                the safety filter.
              </p>
            </div>
            <Button
              aria-label="Close block confirmation"
              disabled={isPending}
              onClick={() => {
                setOpen(false);
              }}
              size="icon"
              type="button"
              variant="ghost"
            >
              <X />
            </Button>
          </div>

          <fetcher.Form className="flex flex-wrap gap-2" method="post" {...actionProps}>
            <input name="intent" type="hidden" value="block" />
            <input name="questionPublicId" type="hidden" value={questionPublicId} />
            <Button disabled={disabled || isPending} size="sm" type="submit">
              <Ban data-icon="inline-start" />
              Confirm block
            </Button>
            <Button
              disabled={isPending}
              onClick={() => {
                setOpen(false);
              }}
              size="sm"
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
          </fetcher.Form>
        </div>
      ) : undefined}

      {result === undefined ? undefined : <ActionResultMessage result={result} />}
    </div>
  );
}

export function ReportQuestionDialog({
  action,
  disabled,
  questionPublicId,
}: QuestionModerationControlsProps) {
  const descriptionId = useId();
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const fetcher = useFetcher<InboxFetcherData>();
  const isPending = fetcher.state !== "idle";
  const result = fetcher.data?.inbox;
  const actionProps = getActionProps(action);

  return (
    <div className="flex flex-col gap-2">
      <Button
        disabled={disabled || isPending}
        onClick={() => {
          setOpen(true);
        }}
        size="sm"
        type="button"
        variant="outline"
      >
        <Flag data-icon="inline-start" />
        Report
      </Button>

      {open ? (
        <div
          aria-describedby={descriptionId}
          aria-labelledby={titleId}
          aria-modal="true"
          className="mt-1 flex w-full min-w-64 max-w-md flex-col gap-3 rounded-md border bg-surface p-3 shadow-sm"
          role="dialog"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-semibold" id={titleId}>
                Report question
              </h3>
              <p
                className="text-sm leading-6 text-muted-foreground"
                id={descriptionId}
              >
                Reports stay private and are only available for moderation review.
              </p>
            </div>
            <Button
              aria-label="Close report dialog"
              disabled={isPending}
              onClick={() => {
                setOpen(false);
              }}
              size="icon"
              type="button"
              variant="ghost"
            >
              <X />
            </Button>
          </div>

          <fetcher.Form
            aria-label="Report question"
            className="flex flex-col gap-3"
            method="post"
            {...actionProps}
          >
            <input name="intent" type="hidden" value="report" />
            <input name="questionPublicId" type="hidden" value={questionPublicId} />
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
                {moderationReportReasonValues.map((reason) => (
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
            <div className="flex flex-wrap gap-2">
              <Button disabled={disabled || isPending} size="sm" type="submit">
                <Send data-icon="inline-start" />
                Submit report
              </Button>
              <Button
                disabled={isPending}
                onClick={() => {
                  setOpen(false);
                }}
                size="sm"
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
            </div>
          </fetcher.Form>
        </div>
      ) : undefined}

      {result === undefined ? undefined : <ActionResultMessage result={result} />}
    </div>
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

function getActionProps(action: string | undefined) {
  return action === undefined ? {} : { action };
}
