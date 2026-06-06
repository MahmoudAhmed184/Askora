import { AlertTriangle, Inbox, Search } from "lucide-react";
import { Link } from "react-router";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { adminQueueStatusValues } from "~/features/admin/admin.schema";
import {
  reportReasonLabels,
  reportStatusLabels,
  targetTypeLabels,
} from "~/features/admin/components/admin-labels";
import type { AdminReportQueueViewData } from "~/features/admin/admin.loader.server";
import { formatMediumDateTime } from "~/lib/date-format";
import { cn } from "~/lib/utils";

interface ReportQueueProps {
  queue: AdminReportQueueViewData;
}

export function ReportQueue({ queue }: ReportQueueProps) {
  return (
    <section className="overflow-hidden rounded-3xl border bg-card text-card-foreground shadow-[var(--shadow-card)]">
      <div className="border-b bg-secondary px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-serif text-xl font-extrabold leading-tight text-foreground">
              Queue
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Select a report to inspect detail and action states.
            </p>
          </div>
          <ReportStatusFilters queue={queue} />
        </div>
      </div>
      {queue.reports.length === 0 ? (
        <EmptyQueueState />
      ) : (
        <div className="divide-y divide-border">
          {queue.reports.map((report) => (
            <ReportQueueRow key={report.id} report={report} />
          ))}
        </div>
      )}
    </section>
  );
}

function ReportStatusFilters({ queue }: ReportQueueProps) {
  return (
    <nav
      aria-label="Report status filters"
      className="flex max-w-full flex-wrap gap-1"
    >
      {adminQueueStatusValues.map((status) => {
        const isActive = queue.status === status;

        return (
          <Link
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "inline-flex h-8 shrink-0 items-center gap-2 rounded-full border px-3 text-xs font-bold transition-colors",
              isActive
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground hover:bg-surface hover:text-foreground",
            )}
            key={status}
            to={status === "open" ? "/admin" : `/admin?status=${status}`}
          >
            <span>{reportStatusLabels[status]}</span>
            <span className="font-mono tabular-nums">{queue.counts[status]}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function EmptyQueueState() {
  return (
    <div className="flex flex-col items-start gap-3 px-5 py-6 sm:px-6">
      <div className="rounded-xl bg-surface p-2 text-muted-foreground">
        <Inbox aria-hidden="true" className="size-4" />
      </div>
      <div>
        <h3 className="text-base font-bold text-foreground">
          No reports in this queue
        </h3>
        <p className="mt-1 max-w-prose text-sm leading-6 text-muted-foreground">
          Reports with this status will appear here when they need review.
        </p>
      </div>
    </div>
  );
}

function ReportQueueRow({
  report,
}: {
  report: AdminReportQueueViewData["reports"][number];
}) {
  return (
    <article className="px-5 py-4 transition-colors hover:bg-secondary/55 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 sm:flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{reportReasonLabels[report.reason]}</Badge>
            <Badge variant="outline">{reportStatusLabels[report.status]}</Badge>
            <span className="font-mono text-[0.68rem] text-muted-foreground">
              {formatDateTime(report.createdAt)}
            </span>
          </div>

          <div className="min-w-0">
            <h3 className="break-words text-base font-bold text-foreground">
              {report.targetLabel}
            </h3>
            <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
              {report.contentPreview}
            </p>
          </div>

          {report.detailsPreview !== null ? (
            <p className="mt-3 line-clamp-2 rounded-xl bg-surface px-3.5 py-2.5 text-sm leading-6 text-foreground/90">
              {report.detailsPreview}
            </p>
          ) : null}
        </div>

        <Button asChild className="shrink-0" size="sm" variant="outline">
          <Link className="gap-2" to={`/admin/reports/${report.id}`}>
            <Search aria-hidden="true" className="size-4" />
            Review
          </Link>
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span className="rounded-full bg-surface px-2.5 py-1">
          {targetTypeLabels[report.targetType]}
        </span>
        {report.targetStatus === "missing" ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-1 text-destructive">
            <AlertTriangle aria-hidden="true" className="size-3" />
            Missing
          </span>
        ) : null}
        {report.metadata.map((item) => (
          <span className="rounded-full bg-surface px-2.5 py-1" key={item}>
            {item}
          </span>
        ))}
      </div>
    </article>
  );
}

function formatDateTime(value: string) {
  return formatMediumDateTime(value);
}
