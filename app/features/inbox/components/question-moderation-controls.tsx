import { Ban, Flag, MoreHorizontal, Send, X } from "lucide-react";
import { useId, useState } from "react";
import { useFetcher } from "react-router";

import { ActionToast } from "~/components/app/action-toast";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
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
type ActivePanel = "menu" | "report" | "block" | null;

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
  variant = "menu",
}: QuestionModerationControlsProps) {
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const fetcher = useFetcher<InboxFetcherData>();
  const isPending = fetcher.state !== "idle";
  const result = fetcher.data?.inbox;
  const actionProps = getActionProps(action);

  const panelPositionClassName =
    variant === "inline" ? "bottom-12 left-0" : "right-0 top-11";

  return (
    <div className="relative">
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
        />
      )}

      {activePanel === "report" ? (
        <ReportPanel
          actionProps={actionProps}
          disabled={disabled}
          fetcher={fetcher}
          isPending={isPending}
          onClose={() => {
            setActivePanel(null);
          }}
          panelPositionClassName={panelPositionClassName}
          questionPublicId={questionPublicId}
          result={result}
        />
      ) : null}

      {activePanel === "block" ? (
        <BlockPanel
          actionProps={actionProps}
          disabled={disabled}
          fetcher={fetcher}
          isPending={isPending}
          onClose={() => {
            setActivePanel(null);
          }}
          panelPositionClassName={panelPositionClassName}
          questionPublicId={questionPublicId}
          result={result}
        />
      ) : null}
    </div>
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
  disabled,
  onOpenChange,
  open,
  onBlock,
  onReport,
}: {
  disabled: boolean;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  onBlock: () => void;
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
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function BlockPanel({
  actionProps,
  disabled,
  fetcher,
  isPending,
  onClose,
  panelPositionClassName,
  questionPublicId,
  result,
}: {
  actionProps: Record<string, string>;
  disabled: boolean;
  fetcher: InboxFetcher;
  isPending: boolean;
  onClose: () => void;
  panelPositionClassName: string;
  questionPublicId: string;
  result: InboxActionResult | undefined;
}) {
  const descriptionId = useId();
  const titleId = useId();

  return (
    <div
      aria-describedby={descriptionId}
      aria-labelledby={titleId}
      className={`absolute ${panelPositionClassName} z-[60] flex w-[min(20rem,calc(100vw-2rem))] flex-col gap-3 rounded-2xl border bg-card p-4 text-card-foreground shadow-[var(--shadow-card-hover)] max-sm:pb-8`}
      role="dialog"
    >
      <PanelHeader
        descriptionId={descriptionId}
        description="Future private questions from this sender will be handled by the safety filter."
        isPending={isPending}
        onClose={onClose}
        title="Block sender?"
        titleId={titleId}
      />

      <fetcher.Form className="flex flex-wrap gap-2" method="post" {...actionProps}>
        <input name="intent" type="hidden" value="block" />
        <input name="questionPublicId" type="hidden" value={questionPublicId} />
        <Button disabled={disabled || isPending} size="sm" type="submit">
          <Ban data-icon="inline-start" />
          Confirm block
        </Button>
        <Button
          disabled={isPending}
          onClick={onClose}
          size="sm"
          type="button"
          variant="outline"
        >
          Cancel
        </Button>
      </fetcher.Form>

      <ActionResultToast result={result} />
    </div>
  );
}

function ReportPanel({
  actionProps,
  disabled,
  fetcher,
  isPending,
  onClose,
  panelPositionClassName,
  questionPublicId,
  result,
}: {
  actionProps: Record<string, string>;
  disabled: boolean;
  fetcher: InboxFetcher;
  isPending: boolean;
  onClose: () => void;
  panelPositionClassName: string;
  questionPublicId: string;
  result: InboxActionResult | undefined;
}) {
  const descriptionId = useId();
  const titleId = useId();

  return (
    <div
      aria-describedby={descriptionId}
      aria-labelledby={titleId}
      className={`absolute ${panelPositionClassName} z-[60] flex w-[min(20rem,calc(100vw-2rem))] flex-col gap-3 rounded-2xl border bg-card p-4 text-card-foreground shadow-[var(--shadow-card-hover)]`}
      role="dialog"
    >
      <PanelHeader
        descriptionId={descriptionId}
        description="Reports stay private and are only available for moderation review."
        isPending={isPending}
        onClose={onClose}
        title="Report question"
        titleId={titleId}
      />

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
            className="h-10 rounded-xl border border-input bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30"
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
            onClick={onClose}
            size="sm"
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
        </div>
      </fetcher.Form>

      <ActionResultToast result={result} />
    </div>
  );
}

function PanelHeader({
  description,
  descriptionId,
  isPending,
  onClose,
  title,
  titleId,
}: {
  description: string;
  descriptionId: string;
  isPending: boolean;
  onClose: () => void;
  title: string;
  titleId: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold" id={titleId}>
          {title}
        </h3>
        <p className="text-sm leading-6 text-muted-foreground" id={descriptionId}>
          {description}
        </p>
      </div>
      <Button
        aria-label={`Close ${title.toLowerCase()}`}
        disabled={isPending}
        onClick={onClose}
        size="icon"
        type="button"
        variant="ghost"
      >
        <X />
      </Button>
    </div>
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
