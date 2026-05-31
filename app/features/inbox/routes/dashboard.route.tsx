import { Link } from "react-router";
import { Filter, Inbox } from "lucide-react";
import type { ReactNode } from "react";

import type { Route } from "./+types/dashboard.route";
import { DashboardShell } from "~/components/app/dashboard-shell";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { loadInboxDashboard } from "~/features/inbox/inbox.loader.server";

export async function loader({ request }: Route.LoaderArgs) {
  const { isSessionSuspended, requireCompletedProfileSession } = await import(
    "~/features/auth/auth.server"
  );
  const session = await requireCompletedProfileSession(request);

  if (session instanceof Response) {
    return session;
  }

  return {
    dashboard: await loadInboxDashboard({ session }),
    isSuspended: isSessionSuspended(session),
  };
}

export function meta() {
  return [{ title: "Dashboard | qna-platform" }];
}

export default function DashboardRoute({ loaderData }: Route.ComponentProps) {
  const { counts, profile } = loaderData.dashboard;

  return (
    <DashboardShell>
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-3 border-b pb-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Dashboard</Badge>
            {loaderData.isSuspended ? <Badge variant="outline">Locked</Badge> : null}
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-semibold tracking-normal">
              {profile.displayName}
            </h1>
            <p className="text-sm leading-6 text-muted-foreground">
              @{profile.username}
            </p>
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-2" aria-label="Inbox overview">
          <OverviewCard
            count={counts.inbox}
            description="Private questions ready for review."
            href="/dashboard/inbox"
            icon={<Inbox aria-hidden="true" className="size-4" />}
            label="Inbox"
          />
          <OverviewCard
            count={counts.filtered}
            description="Questions held by muted phrases or safety checks."
            href="/dashboard/filtered"
            icon={<Filter aria-hidden="true" className="size-4" />}
            label="Filtered"
          />
        </section>
      </div>
    </DashboardShell>
  );
}

function OverviewCard({
  count,
  description,
  href,
  icon,
  label,
}: {
  count: number;
  description: string;
  href: string;
  icon: ReactNode;
  label: string;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">{label}</CardTitle>
          <span className="text-muted-foreground">{icon}</span>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex items-end justify-between gap-4">
        <p className="text-3xl font-semibold tabular-nums">{count}</p>
        <Button asChild size="sm" variant="outline">
          <Link to={href}>Open</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
