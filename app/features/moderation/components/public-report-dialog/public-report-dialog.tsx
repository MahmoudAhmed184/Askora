import { Flag, LoaderCircle, Send } from "lucide-react";
import { useCallback, useEffect, useId, useState } from "react";
import { useFetcher } from "react-router";

import { ActionToast } from "~/components/shared/action-toast/action-toast";
import { Button } from "~/components/ui/button/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog/dialog";
import { Field, FieldLabel } from "~/components/ui/field/field";
import { Select } from "~/components/ui/select/select";
import { Textarea } from "~/components/ui/textarea/textarea";
import { moderationReportReasonValues } from "~/db/schema/moderation-values";
import type { PublicContentReportResult } from "~/features/moderation/services/public-report.service.server";

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
} as const;

interface PublicReportDialogProps {
  canReport: boolean;
  onOpenChange?: ((open: boolean) => void) | undefined;
  open?: boolean | undefined;
  targetId: string;
  targetType: "thread_item" | "profile";
  targetLabel: "answer" | "profile";
  trigger?: "button" | "none";
}

interface ReportFetcherData {
  report: PublicContentReportResult;
}

export function PublicReportDialog({
  canReport,
  onOpenChange,
  open,
  targetId,
  targetLabel,
  targetType,
  trigger = "button",
}: PublicReportDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const fetcher = useFetcher<ReportFetcherData>();
  const result = fetcher.data?.report;
  const reasonId = useId();
  const detailsId = useId();
  const isPending = fetcher.state !== "idle";
  const targetName = targetLabel === "answer" ? "answer" : "profile";
  const isControlled = open !== undefined;
  const dialogOpen = isControlled ? open : internalOpen;

  const setDialogOpen = useCallback(
    (nextOpen: boolean) => {
      if (!isControlled) {
        setInternalOpen(nextOpen);
      }

      onOpenChange?.(nextOpen);
    },
    [isControlled, onOpenChange],
  );

  useEffect(() => {
    if (result?.status === "created") {
      const timeoutId = window.setTimeout(() => {
        setDialogOpen(false);
      }, 0);
      return () => {
        window.clearTimeout(timeoutId);
      };
    }

    return undefined;
  }, [result, setDialogOpen]);

  if (!canReport) {
    return null;
  }

  return (
    <>
      {trigger === "button" ? (
        <Button
          aria-label={`Report ${targetName}`}
          onClick={() => {
            setDialogOpen(true);
          }}
          size="sm"
          type="button"
          variant="outline"
        >
          <Flag data-icon="inline-start" />
          Report
        </Button>
      ) : null}

      <Dialog onOpenChange={setDialogOpen} open={dialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Report {targetName}</DialogTitle>
            <DialogDescription>
              Reports stay private and are only available for moderation review.
            </DialogDescription>
          </DialogHeader>

          <fetcher.Form
            aria-label={`Report ${targetName}`}
            className="flex flex-col gap-4"
            method="post"
            action="/reports"
          >
            <input name="targetType" type="hidden" value={targetType} />
            <input name="targetId" type="hidden" value={targetId} />
            <Field>
              <FieldLabel htmlFor={reasonId}>Reason</FieldLabel>
              <Select
                defaultValue=""
                disabled={isPending}
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
                disabled={isPending}
                id={detailsId}
                maxLength={500}
                name="details"
                placeholder="Optional context for moderators"
                rows={3}
              />
            </Field>
            <DialogFooter>
              <Button
                disabled={isPending}
                onClick={() => {
                  setDialogOpen(false);
                }}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button disabled={isPending} type="submit">
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

      <ActionToast
        message={getReportToastMessage(result)}
        tone={result?.status === "created" ? "success" : "error"}
        trigger={result}
      />
    </>
  );
}

function getReportToastMessage(result: PublicContentReportResult | undefined) {
  if (result === undefined) {
    return undefined;
  }

  if (result.status === "created") {
    return "Report submitted.";
  }

  return result.formError;
}
