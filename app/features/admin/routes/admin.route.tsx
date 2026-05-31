import { AdminShell } from "~/components/app/admin-shell";
import { Badge } from "~/components/ui/badge";
import type { AdminQueueStatus } from "~/features/admin/admin.schema";
import { ReportQueue } from "~/features/admin/components/report-queue";
import { loadAdminIndexRoute } from "~/features/admin/routes/admin-route-handlers.server";

import type { Route } from "./+types/admin.route";

export async function loader({ request }: Route.LoaderArgs) {
  return loadAdminIndexRoute({ request });
}

export function meta() {
  return [{ title: "Admin reports | qna-platform" }];
}

export default function AdminRoute({ loaderData }: Route.ComponentProps) {
  return (
    <AdminShell>
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-3 border-b pb-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Admin</Badge>
            <Badge variant="outline">{statusLabel(loaderData.queue.status)}</Badge>
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-semibold tracking-normal">
              Moderation reports
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Review reports, inspect related activity, and apply account or
              content actions.
            </p>
          </div>
        </header>

        <ReportQueue queue={loaderData.queue} />
      </div>
    </AdminShell>
  );
}

function statusLabel(status: AdminQueueStatus) {
  return `${status[0]?.toUpperCase() ?? ""}${status.slice(1)}`;
}
