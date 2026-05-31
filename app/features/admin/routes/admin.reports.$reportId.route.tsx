import { ArrowLeft } from "lucide-react";
import { Link, useActionData } from "react-router";

import { AdminShell } from "~/components/app/admin-shell";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { AdminActionForm } from "~/features/admin/components/admin-action-form";
import { RelatedActivityPanel } from "~/features/admin/components/related-activity-panel";
import { ReportDetail } from "~/features/admin/components/report-detail";
import {
  handleAdminReportActionRoute,
  loadAdminReportDetailRoute,
} from "~/features/admin/routes/admin-route-handlers.server";

import type { Route } from "./+types/admin.reports.$reportId.route";

export async function loader({ params, request }: Route.LoaderArgs) {
  return loadAdminReportDetailRoute({
    reportId: params.reportId,
    request,
  });
}

export async function action({ params, request }: Route.ActionArgs) {
  return handleAdminReportActionRoute({
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
      <AdminShell>
        <div className="flex flex-col gap-4 border-b pb-5">
          <Badge className="w-fit" variant="secondary">
            Admin
          </Badge>
          <h1 className="text-3xl font-semibold tracking-normal">
            Report not found
          </h1>
          <Button asChild className="w-fit gap-2" variant="outline">
            <Link to="/admin">
              <ArrowLeft aria-hidden="true" className="size-4" />
              Back to reports
            </Link>
          </Button>
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-3 border-b pb-5">
          <Button asChild className="w-fit gap-2" size="sm" variant="ghost">
            <Link to="/admin">
              <ArrowLeft aria-hidden="true" className="size-4" />
              Reports
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Report</Badge>
            <Badge variant="outline">{loaderData.detail.report.id}</Badge>
          </div>
          <h1 className="text-3xl font-semibold tracking-normal">
            Report review
          </h1>
        </header>

        <ReportDetail detail={loaderData.detail} />

        <AdminActionForm
          actionResult={actionData?.adminAction}
          availableActions={loaderData.detail.availableActions}
        />

        <RelatedActivityPanel related={loaderData.detail.related} />
      </div>
    </AdminShell>
  );
}
