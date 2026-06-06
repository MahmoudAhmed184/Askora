import * as React from "react";
import {
  AlertTriangle,
  Check,
  ClipboardList,
  EyeOff,
  Flag,
  ShieldAlert,
} from "lucide-react";

import { GeminiNotification } from "../components/notifications/gemini-notification";
import { usePrototypeToast } from "../components/use-prototype-toast";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "../components/ui/field";
import { Separator } from "../components/ui/separator";
import { Switch } from "../components/ui/switch";
import { Textarea } from "../components/ui/textarea";
import { cn } from "../lib/utils";

type ReportReason =
  | "harassment"
  | "hate"
  | "threats"
  | "sexual"
  | "self-harm"
  | "private-info"
  | "impersonation"
  | "spam"
  | "other";

type AdminAction =
  | "dismiss"
  | "warn"
  | "suspend-7"
  | "suspend-30"
  | "permanent-suspension"
  | "hide-profile"
  | "remove-content";

type ReportQueueItem = {
  details: string;
  entity: "answer" | "profile" | "question";
  id: string;
  reporter: string;
  reportedUser: string;
  reason: ReportReason;
  severity: "medium" | "high" | "urgent";
  time: string;
};

const reportReasons = [
  { value: "harassment", label: "Harassment or bullying" },
  { value: "hate", label: "Hate" },
  { value: "threats", label: "Threats or violence" },
  { value: "sexual", label: "Sexual content" },
  { value: "self-harm", label: "Self-harm" },
  { value: "private-info", label: "Private information or doxxing" },
  { value: "impersonation", label: "Impersonation" },
  { value: "spam", label: "Spam or scam" },
  { value: "other", label: "Other" },
] as const;

const adminActions = [
  { value: "dismiss", label: "Dismiss report" },
  { value: "warn", label: "Warn account" },
  { value: "suspend-7", label: "Suspend for 7 days" },
  { value: "suspend-30", label: "Suspend for 30 days" },
  { value: "permanent-suspension", label: "Permanent suspension" },
  { value: "hide-profile", label: "Hide profile" },
  { value: "remove-content", label: "Remove specific content" },
] as const;

const queueItems = [
  {
    details:
      "Reported answer includes direct insults and a private school name in the same paragraph.",
    entity: "answer",
    id: "report-1024",
    reporter: "@alexl",
    reportedUser: "@mayachen",
    reason: "private-info",
    severity: "high",
    time: "12m ago",
  },
  {
    details:
      "Profile bio appears to impersonate another creator and links to a scam page.",
    entity: "profile",
    id: "report-1023",
    reporter: "@sarahm",
    reportedUser: "@fakecreator",
    reason: "impersonation",
    severity: "medium",
    time: "1h ago",
  },
  {
    details:
      "Private question mentions self-harm. Needs careful triage and calm handling.",
    entity: "question",
    id: "report-1022",
    reporter: "@mayachen",
    reportedUser: "anonymous signal",
    reason: "self-harm",
    severity: "urgent",
    time: "2h ago",
  },
] as const satisfies readonly ReportQueueItem[];

export function AdminPage() {
  const [reportReason, setReportReason] =
    React.useState<ReportReason>("harassment");
  const [reportDetails, setReportDetails] = React.useState("");
  const [alsoBlock, setAlsoBlock] = React.useState(true);
  const [userReportStatus, setUserReportStatus] = React.useState<
    { tone: "danger" | "success"; message: string } | null
  >(null);
  const [selectedReportId, setSelectedReportId] = React.useState<string>(
    queueItems[0].id,
  );
  const [adminAction, setAdminAction] =
    React.useState<AdminAction>("dismiss");
  const [adminNotes, setAdminNotes] = React.useState("");
  const [actionStatus, setActionStatus] = React.useState<
    { tone: "danger" | "success"; message: string } | null
  >(null);
  const { toast, triggerToast } = usePrototypeToast();

  const selectedReport =
    queueItems.find((item) => item.id === selectedReportId) ?? queueItems[0];

  function submitUserReport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setUserReportStatus({
      message: alsoBlock
        ? "Report submitted and sender block is selected."
        : "Report submitted without blocking the sender.",
      tone: "success",
    });
    triggerToast("User report submitted.");
  }

  function submitAdminAction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (requiresAdminNotes(adminAction) && adminNotes.trim().length < 12) {
      setActionStatus({
        message:
          "Admin notes are required for suspensions, profile hides, and content removals.",
        tone: "danger",
      });
      return;
    }

    setActionStatus({
      message: `Action recorded for ${selectedReport.id}.`,
      tone: "success",
    });
    triggerToast("Admin action recorded.");
  }

  return (
    <div className="gemini-profile">
      <main className="gemini-app-shell" role="main">
        <AdminHeader />

        <div className="grid w-full gap-6 lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)] lg:items-start">
          <aside className="gemini-flow-column min-w-0 lg:sticky lg:top-6">
            <ReportQueue
              onSelectReport={(reportId) => {
                setSelectedReportId(reportId);
                setActionStatus(null);
              }}
              selectedReportId={selectedReportId}
            />

            <RelatedActivityPanel />

            <UserReportForm
              alsoBlock={alsoBlock}
              onAlsoBlockChange={setAlsoBlock}
              onReportDetailsChange={setReportDetails}
              onReportReasonChange={setReportReason}
              onSubmit={submitUserReport}
              reportDetails={reportDetails}
              reportReason={reportReason}
              status={userReportStatus}
            />
          </aside>

          <ReportDetail
            actionStatus={actionStatus}
            adminAction={adminAction}
            adminNotes={adminNotes}
            onAdminActionChange={setAdminAction}
            onAdminNotesChange={setAdminNotes}
            onSubmitAction={submitAdminAction}
            report={selectedReport}
          />
        </div>
      </main>

      <GeminiNotification
        message={toast?.message ?? ""}
        open={Boolean(toast)}
        tone={toast?.tone ?? "success"}
      />
    </div>
  );
}

function AdminHeader() {
  return (
    <section className="gemini-profile-header-container">
      <div className="gemini-cover-banner">
        <div className="gemini-grid-overlay" />
      </div>

      <div className="gemini-profile-body-inner">
        <div className="gemini-profile-meta-top">
          <div className="gemini-avatar-wrapper">
            <div aria-label="Admin moderation" className="gemini-profile-avatar">
              AD
            </div>
          </div>

          <div className="gemini-profile-info">
            <h1 className="gemini-profile-name">Moderation Queue</h1>
            <p className="gemini-profile-handle">
              reports · queue · detail · action log
            </p>
            <p className="gemini-profile-bio">
              User report form plus admin queue and detail states. Severe
              actions require notes before recording.
            </p>
          </div>
        </div>

        <div className="gemini-profile-stats">
          <span className="gemini-stat-pill">
            <strong>3</strong> open reports
          </span>
          <span className="gemini-stat-pill">
            <strong>1</strong> urgent
          </span>
          <span className="gemini-stat-pill">
            <strong>2</strong> require review
          </span>
        </div>
      </div>
    </section>
  );
}

function UserReportForm({
  alsoBlock,
  onAlsoBlockChange,
  onReportDetailsChange,
  onReportReasonChange,
  onSubmit,
  reportDetails,
  reportReason,
  status,
}: {
  alsoBlock: boolean;
  onAlsoBlockChange: (checked: boolean) => void;
  onReportDetailsChange: (details: string) => void;
  onReportReasonChange: (reason: ReportReason) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  reportDetails: string;
  reportReason: ReportReason;
  status: { tone: "danger" | "success"; message: string } | null;
}) {
  return (
    <form
      aria-label="User report form"
      className="gemini-content-card overflow-hidden"
      onSubmit={onSubmit}
    >
      <div className="mb-5 border-b border-border pb-5">
        <h2 className="gemini-feed-title">User Report Form</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Logged-in users can report private questions, public answers, and
          profiles. Details are optional.
        </p>
      </div>

      <FieldGroup className="gap-5">
        <Field>
          <FieldLabel htmlFor="user-report-reason">Reason</FieldLabel>
          <NativeSelect
            id="user-report-reason"
            onChange={(event) => {
              onReportReasonChange(event.target.value as ReportReason);
            }}
            value={reportReason}
          >
            {reportReasons.map((reason) => (
              <option key={reason.value} value={reason.value}>
                {reason.label}
              </option>
            ))}
          </NativeSelect>
        </Field>

        <Field>
          <div className="flex items-center justify-between gap-4">
            <FieldLabel htmlFor="user-report-details">
              Optional details
            </FieldLabel>
            <span className="font-mono text-[0.68rem] text-muted-foreground">
              {reportDetails.length}/500
            </span>
          </div>
          <Textarea
            id="user-report-details"
            maxLength={500}
            onChange={(event) => {
              onReportDetailsChange(event.target.value);
            }}
            placeholder="Add context for moderators..."
            value={reportDetails}
          />
        </Field>

        <div className="flex items-center justify-between gap-4 rounded-[0.625rem] border border-border bg-secondary p-3">
          <div>
            <p className="text-sm font-bold text-foreground">
              Also block sender
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Default on for private question reports.
            </p>
          </div>
          <Switch
            aria-label="Also block sender"
            checked={alsoBlock}
            onCheckedChange={onAlsoBlockChange}
          />
        </div>

        {status ? <InlineStatus tone={status.tone}>{status.message}</InlineStatus> : null}

        <Button type="submit">
          <Flag data-icon="inline-start" />
          Submit report
        </Button>

        <div aria-hidden="true" className="h-20" />
      </FieldGroup>
    </form>
  );
}

function ReportQueue({
  onSelectReport,
  selectedReportId,
}: {
  onSelectReport: (reportId: string) => void;
  selectedReportId: string;
}) {
  return (
    <aside className="gemini-content-card overflow-hidden p-0">
      <div className="border-b border-border bg-secondary px-4 py-4">
        <h2 className="text-sm font-bold text-foreground">Queue</h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Select a report to inspect detail and action states.
        </p>
      </div>
      <div className="divide-y divide-border">
        {queueItems.map((item) => {
          const isSelected = item.id === selectedReportId;

          return (
            <button
              className={cn(
                "block w-full px-4 py-4 text-left transition-colors",
                isSelected ? "bg-primary/10" : "hover:bg-secondary/70",
              )}
              key={item.id}
              onClick={() => {
                onSelectReport(item.id);
              }}
              type="button"
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <SeverityBadge severity={item.severity} />
                <span className="font-mono text-[0.68rem] text-muted-foreground">
                  {item.time}
                </span>
              </div>
              <p className="text-sm font-bold text-foreground">{item.id}</p>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {formatReason(item.reason)} · {item.entity}
              </p>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function ReportDetail({
  actionStatus,
  adminAction,
  adminNotes,
  onAdminActionChange,
  onAdminNotesChange,
  onSubmitAction,
  report,
}: {
  actionStatus: { tone: "danger" | "success"; message: string } | null;
  adminAction: AdminAction;
  adminNotes: string;
  onAdminActionChange: (action: AdminAction) => void;
  onAdminNotesChange: (notes: string) => void;
  onSubmitAction: (event: React.FormEvent<HTMLFormElement>) => void;
  report: ReportQueueItem;
}) {
  return (
    <section className="gemini-flow-column min-w-0">
      <article className="gemini-content-card min-w-0 overflow-hidden p-0">
        <div className="border-b border-border bg-secondary px-5 py-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-mono text-[0.68rem] font-bold text-primary">
                {report.id}
              </p>
              <h2 className="mt-2 font-serif text-3xl font-extrabold text-foreground">
                Report detail
              </h2>
            </div>
            <SeverityBadge className="self-start" severity={report.severity} />
          </div>
        </div>

        <div className="grid min-w-0 gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_17rem]">
          <section className="rounded-[0.625rem] border border-border bg-background p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="outline">{report.entity}</Badge>
              <Badge variant="secondary">{formatReason(report.reason)}</Badge>
            </div>
            <p className="text-sm leading-7 text-foreground/90">
              {report.details}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <KeyValue label="Reporter" value={report.reporter} />
              <KeyValue label="Reported user" value={report.reportedUser} />
            </div>
          </section>

          <aside className="rounded-[0.625rem] border border-border bg-background p-4">
            <h3 className="text-sm font-bold text-foreground">
              Safety metadata
            </h3>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Admins do not get a clean identity-reveal view for anonymous
              askers.
            </p>
            <div className="mt-4 flex flex-col gap-3">
              <KeyValue label="Signal" value="anon-fingerprint-7d4" />
              <KeyValue label="Rate limit" value="3 of 5 per hour" />
              <KeyValue label="Retention" value="180 days if report-linked" />
            </div>
          </aside>
        </div>
      </article>

      <article className="gemini-content-card min-w-0 lg:mt-16">
        <h3 className="gemini-feed-title">Admin action</h3>
        <form className="mt-4" onSubmit={onSubmitAction}>
          <FieldGroup className="gap-5">
            <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <Field>
                <FieldLabel htmlFor="admin-action">Action</FieldLabel>
                <NativeSelect
                  id="admin-action"
                  onChange={(event) => {
                    onAdminActionChange(event.target.value as AdminAction);
                  }}
                  value={adminAction}
                >
                  {adminActions.map((action) => (
                    <option key={action.value} value={action.value}>
                      {action.label}
                    </option>
                  ))}
                </NativeSelect>
                <FieldDescription>
                  Notes are required for suspensions, profile hides, and content
                  removals.
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="admin-notes">Admin notes</FieldLabel>
                <Textarea
                  className="min-h-28"
                  id="admin-notes"
                  onChange={(event) => {
                    onAdminNotesChange(event.target.value);
                  }}
                  placeholder="Record the reason for severe actions..."
                  value={adminNotes}
                />
              </Field>
            </div>

            {actionStatus ? (
              <InlineStatus tone={actionStatus.tone}>
                {actionStatus.message}
              </InlineStatus>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button type="submit">
                <Check data-icon="inline-start" />
                Record action
              </Button>
              <Button
                onClick={() => {
                  onAdminActionChange("remove-content");
                }}
                type="button"
                variant="destructive"
              >
                <EyeOff data-icon="inline-start" />
                Prepare removal
              </Button>
            </div>

            <div aria-hidden="true" className="h-20 sm:hidden" />
          </FieldGroup>
        </form>
      </article>
    </section>
  );
}

function RelatedActivityPanel() {
  return (
    <section className="gemini-content-card">
      <div className="mb-3 flex items-center gap-2">
        <ClipboardList data-icon="inline-start" />
        <h3 className="text-sm font-bold text-foreground">Related activity</h3>
      </div>
      <ul className="flex flex-col gap-3 text-sm leading-6 text-muted-foreground">
        <li>5 recent submissions to this recipient in the last hour.</li>
        <li>2 filtered matches with similar wording in the last day.</li>
        <li>Limited safety metadata retained for beta moderation.</li>
      </ul>
    </section>
  );
}

function SeverityBadge({
  className,
  severity,
}: {
  className?: string;
  severity: ReportQueueItem["severity"];
}) {
  if (severity === "urgent") {
    return (
      <Badge className={className} variant="destructive">
        <ShieldAlert data-icon="inline-start" />
        Urgent
      </Badge>
    );
  }

  if (severity === "high") {
    return (
      <Badge className={className} variant="destructive">
        <AlertTriangle data-icon="inline-start" />
        High
      </Badge>
    );
  }

  return (
    <Badge className={className} variant="secondary">
      Medium
    </Badge>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-[0.625rem] border border-border bg-secondary px-3 py-2">
      <p className="font-mono text-[0.62rem] text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-bold text-foreground">{value}</p>
    </div>
  );
}

function NativeSelect({
  className,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "flex h-10 w-full min-w-0 rounded-[0.625rem] border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

function InlineStatus({
  children,
  tone = "success",
}: {
  children: React.ReactNode;
  tone?: "danger" | "success";
}) {
  return (
    <div
      className={cn(
        "rounded-[0.625rem] border px-3.5 py-3 text-sm leading-6",
        tone === "success" && "border-success/25 bg-success/10 text-foreground",
        tone === "danger" &&
          "border-destructive/25 bg-destructive/10 text-foreground",
      )}
    >
      {children}
    </div>
  );
}

function formatReason(reason: ReportReason) {
  const match = reportReasons.find((item) => item.value === reason);
  return match?.label ?? reason;
}

function requiresAdminNotes(action: AdminAction) {
  return (
    action === "suspend-7" ||
    action === "suspend-30" ||
    action === "permanent-suspension" ||
    action === "hide-profile" ||
    action === "remove-content"
  );
}
