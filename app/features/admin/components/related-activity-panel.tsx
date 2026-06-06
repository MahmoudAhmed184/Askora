import { Link } from "react-router";

import { Badge } from "~/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  adminActionLabels,
  reportReasonLabels,
  reportStatusLabels,
} from "~/features/admin/components/admin-labels";
import type { AdminReportDetailViewData } from "~/features/admin/admin.loader.server";
import { formatMediumDateTime } from "~/lib/date-format";

interface RelatedActivityPanelProps {
  related: AdminReportDetailViewData["related"];
}

export function RelatedActivityPanel({ related }: RelatedActivityPanelProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Same-target reports</CardTitle>
          <CardDescription>Recent reports for this exact target.</CardDescription>
        </CardHeader>
        <CardContent>
          {related.sameTargetReports.length === 0 ? (
            <EmptyLine>No related reports.</EmptyLine>
          ) : (
            <div className="flex flex-col gap-3">
              {related.sameTargetReports.map((report) => (
                <div className="rounded-xl border bg-surface p-3" key={report.id}>
                  <div className="mb-2 flex flex-wrap gap-2">
                    <Badge variant="secondary">
                      {reportReasonLabels[report.reason]}
                    </Badge>
                    <Badge variant="outline">
                      {reportStatusLabels[report.status]}
                    </Badge>
                  </div>
                  <Link
                    className="text-sm font-medium underline-offset-4 hover:underline"
                    to={`/admin/reports/${report.id}`}
                  >
                    {report.id}
                  </Link>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDateTime(report.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Previous actions</CardTitle>
          <CardDescription>Audit trail for this report target.</CardDescription>
        </CardHeader>
        <CardContent>
          {related.previousAdminActions.length === 0 ? (
            <EmptyLine>No previous admin actions.</EmptyLine>
          ) : (
            <div className="flex flex-col gap-3">
              {related.previousAdminActions.map((action) => (
                <div className="rounded-xl border bg-surface p-3" key={action.id}>
                  <Badge variant="secondary">
                    {adminActionLabels[action.actionType]}
                  </Badge>
                  {action.notes !== null ? (
                    <p className="mt-2 text-sm leading-6">{action.notes}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDateTime(action.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Safety aggregates</CardTitle>
          <CardDescription>Counts only, no raw safety hashes.</CardDescription>
        </CardHeader>
        <CardContent>
          {related.questionSafetyCounts === null ? (
            <EmptyLine>No question safety aggregates for this target.</EmptyLine>
          ) : (
            <dl className="grid gap-3">
              <CountRow
                label="Matching fingerprint"
                value={
                  related.questionSafetyCounts.sameSafetyFingerprintQuestionCount
                }
              />
              <CountRow
                label="Matching IP signal"
                value={related.questionSafetyCounts.sameIpQuestionCount}
              />
              <CountRow
                label="Matching text hash"
                value={
                  related.questionSafetyCounts.sameNormalizedTextQuestionCount
                }
              />
            </dl>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CountRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-surface px-3 py-2">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function EmptyLine({ children }: { children: string }) {
  return <p className="text-sm leading-6 text-muted-foreground">{children}</p>;
}

function formatDateTime(value: string) {
  return formatMediumDateTime(value);
}
