import { AdminShell } from "~/features/admin/components/admin-shell/admin-shell";
import { AdminHero } from "~/features/admin/components/admin-hero";
import { ReportQueue } from "~/features/admin/components/report-queue";
import { loadAdminIndexRoute } from "~/features/admin/services/admin-route-handlers.service.server";

import type { Route } from "./+types/admin.route";

export async function loader({ context, request }: Route.LoaderArgs) {
  return loadAdminIndexRoute({ context, request });
}

export function meta() {
  return [{ title: "Admin reports | qna-platform" }];
}

export default function AdminRoute({ loaderData }: Route.ComponentProps) {
  return (
    <AdminShell shell={loaderData.shell}>
      <div className="flex flex-col gap-6">
        <AdminHero
          stats={[
            { value: loaderData.queue.counts.open, label: "open reports" },
            { value: loaderData.queue.counts.reviewed, label: "reviewed" },
            { value: loaderData.queue.counts.actioned, label: "actioned" },
          ]}
        />

        <ReportQueue queue={loaderData.queue} />
      </div>
    </AdminShell>
  );
}
