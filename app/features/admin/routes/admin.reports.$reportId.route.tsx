import { ArrowLeft } from "lucide-react";
import { Link, useActionData } from "react-router";

import { AdminShell } from "~/features/admin/components/admin-shell/admin-shell";
import { Badge } from "~/components/ui/badge/badge";
import { Button } from "~/components/ui/button/button";
import { AdminActionForm } from "~/features/admin/components/admin-action-form";
import { AdminHero } from "~/features/admin/components/admin-hero";
import {
  reportReasonLabels,
  reportStatusLabels,
  targetTypeLabels,
} from "~/features/admin/components/admin-labels";
import { RelatedActivityPanel } from "~/features/admin/components/related-activity-panel";
import { ReportDetail } from "~/features/admin/components/report-detail";
import type {
  AdminReportDetailViewData
} from "~/features/admin/queries/admin.queries.server";;
import {
  handleAdminReportActionRoute,
  loadAdminReportDetailRoute,
} from "~/features/admin/services/admin-route-handlers.service.server";

import type { Route } from "./+types/admin.reports.$reportId.route";

export async function loader({ context, params, request }: Route.LoaderArgs) {
  return loadAdminReportDetailRoute({
    context,
    reportId: params.reportId,
    request,
  });
}

export async function action({ context, params, request }: Route.ActionArgs) {
  return handleAdminReportActionRoute({
    context,
    reportId: params.reportId,
    request,
  });
}

export function meta() {
  return [{ title: "Admin report detail | qna-platform" }];
}

export default function AdminReportDetailRoute({
  loaderData,
}: Route.ComponentProps) {
  const actionData = useActionData<typeof action>();

  if (loaderData.status === "not_found") {
    return (
      <AdminShell shell={loaderData.shell}>
        <div className="flex flex-col gap-4 rounded-3xl border bg-card p-6 shadow-[var(--shadow-card)]">
          <Badge className="w-fit" variant="secondary">
            Admin
          </Badge>
          <h1 className="font-serif text-4xl font-bold text-primary">
            Report not found
          </h1>
          <Button asChild className="w-fit gap-2" variant="outline">
            <Link to="/admin">
              <ArrowLeft data-icon="inline-start" />
              Back to reports
            </Link>
          </Button>
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell shell={loaderData.shell}>
      <div className="flex flex-col gap-6">
        <AdminHero
          stats={[
            {
              value: reportStatusLabels[loaderData.detail.report.status],
              label: "report",
            },
            {
              value: targetTypeLabels[loaderData.detail.report.targetType],
              label: "target",
            },
            {
              value: loaderData.detail.availableActions.length,
              label: "actions",
            },
          ]}
        />

        <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <AdminReportQueuePreview detail={loaderData.detail} />

          <div className="flex flex-col gap-6 pt-44 sm:pt-0">
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild className="gap-2" size="sm" variant="outline">
                <Link to="/admin">
                  <ArrowLeft data-icon="inline-start" />
                  Reports
                </Link>
              </Button>
              <h2 className="mr-auto font-serif text-2xl font-extrabold leading-tight text-foreground">
                Report review
              </h2>
              <Badge variant="secondary">Report</Badge>
              <Badge variant="outline">{loaderData.detail.report.id}</Badge>
            </div>

            <ReportDetail detail={loaderData.detail} />

            <div className="lg:pt-16">
              <AdminActionForm
                actionResult={actionData?.adminAction}
                availableActions={loaderData.detail.availableActions}
              />
            </div>
          </div>
        </div>

        <RelatedActivityPanel related={loaderData.detail.related} />
      </div>
    </AdminShell>
  );
}

function AdminReportQueuePreview({
  detail,
}: {
  detail: AdminReportDetailViewData;
}) {
  return (
    <section className="h-fit overflow-hidden rounded-3xl border bg-card text-card-foreground shadow-[var(--shadow-card)]">
      <div className="border-b bg-secondary px-5 py-3 sm:py-4">
        <h2 className="font-serif text-lg font-extrabold leading-tight text-foreground">
          Queue
        </h2>
        <p className="mt-1 hidden text-sm leading-6 text-muted-foreground sm:block">
          Current report selected for detail and action review.
        </p>
      </div>
      <div className="bg-secondary/55 px-5 py-3 sm:py-4">
        <div className="mb-2 flex flex-wrap gap-2 sm:mb-3">
          <Badge variant="destructive">
            {reportReasonLabels[detail.report.reason]}
          </Badge>
          <Badge variant="outline">
            {reportStatusLabels[detail.report.status]}
          </Badge>
        </div>
        <p className="font-mono text-sm font-bold text-foreground">
          {detail.report.id}
        </p>
        <p className="mt-1 hidden text-sm leading-6 text-muted-foreground sm:block">
          {targetTypeLabels[detail.report.targetType]} report
        </p>
      </div>
      <div className="hidden px-5 py-4 sm:block">
        <Button asChild className="w-full gap-2" size="sm" variant="outline">
          <Link to="/admin">
            <ArrowLeft data-icon="inline-start" />
            Back to reports
          </Link>
        </Button>
      </div>
    </section>
  );
}
