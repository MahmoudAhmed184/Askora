import { AlertTriangle, Inbox, Search } from "lucide-react";
import { Link } from "react-router";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { adminQueueStatusValues } from "~/features/admin/admin.schema";
import {
  reportReasonLabels,
  reportStatusLabels,
  targetTypeLabels,
} from "~/features/admin/components/admin-labels";
import type { AdminReportQueueViewData } from "~/features/admin/admin.loader.server";
import { cn } from "~/lib/utils";

interface ReportQueueProps {
  queue: AdminReportQueueViewData;
}

export function ReportQueue({ queue }: ReportQueueProps) {
  return (
    <div className="flex flex-col gap-5">
      <nav aria-label="Report status filters" className="flex flex-wrap gap-2">
        {adminQueueStatusValues.map((status) => {
          const isActive = queue.status === status;

          return (
            <Link
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors",
                isActive
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:bg-surface hover:text-foreground",
              )}
              key={status}
              to={status === "open" ? "/admin" : `/admin?status=${status}`}
            >
              <span>{reportStatusLabels[status]}</span>
              <span className="tabular-nums">{queue.counts[status]}</span>
            </Link>
          );
        })}
      </nav>

      {queue.reports.length === 0 ? (
        <Card>
          <CardHeader className="items-start">
            <div className="rounded-md bg-surface p-2 text-muted-foreground">
              <Inbox aria-hidden="true" className="size-4" />
            </div>
            <CardTitle className="text-base">No reports in this queue</CardTitle>
            <CardDescription>
              Reports with this status will appear here when they need review.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-3">
          {queue.reports.map((report) => (
            <ReportQueueRow key={report.id} report={report} />
          ))}
        </div>
      )}
    </div>
  );
}

function ReportQueueRow({
  report,
}: {
  report: AdminReportQueueViewData["reports"][number];
}) {
  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{reportReasonLabels[report.reason]}</Badge>
          <Badge variant="outline">{reportStatusLabels[report.status]}</Badge>
          <Badge variant="outline">{targetTypeLabels[report.targetType]}</Badge>
          {report.targetStatus === "missing" ? (
            <Badge className="gap-1" variant="outline">
              <AlertTriangle aria-hidden="true" className="size-3" />
              Missing
            </Badge>
          ) : null}
        </div>
        <div className="flex flex-col gap-1">
          <CardTitle className="text-base">{report.targetLabel}</CardTitle>
          <CardDescription>{report.contentPreview}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {report.detailsPreview !== null ? (
          <p className="rounded-md bg-surface px-3 py-2 text-sm leading-6">
            {report.detailsPreview}
          </p>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>{formatDateTime(report.createdAt)}</span>
            {report.metadata.map((item) => (
              <span className="rounded-md bg-surface px-2 py-1" key={item}>
                {item}
              </span>
            ))}
          </div>
          <Button asChild size="sm" variant="outline">
            <Link className="gap-2" to={`/admin/reports/${report.id}`}>
              <Search aria-hidden="true" className="size-4" />
              Review
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
