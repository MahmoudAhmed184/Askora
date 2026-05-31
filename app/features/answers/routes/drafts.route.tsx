import { DashboardShell } from "~/components/app/dashboard-shell";
import { Badge } from "~/components/ui/badge";
import { DraftsList } from "~/features/answers/components/drafts-list";
import { loadDraftAnswers } from "~/features/answers/answer.server";

import type { Route } from "./+types/drafts.route";

export async function loader({ request }: Route.LoaderArgs) {
  const { isSessionSuspended, requireCompletedProfileSession } = await import(
    "~/features/auth/auth.server"
  );
  const session = await requireCompletedProfileSession(request);

  if (session instanceof Response) {
    return session;
  }

  return {
    drafts: await loadDraftAnswers({ session }),
    isSuspended: isSessionSuspended(session),
  };
}

export function meta() {
  return [{ title: "Drafts | qna-platform" }];
}

export default function DraftsRoute({ loaderData }: Route.ComponentProps) {
  return (
    <DashboardShell>
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-3 border-b pb-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Drafts</Badge>
            <Badge variant="outline">{loaderData.drafts.drafts.length} total</Badge>
            {loaderData.isSuspended ? <Badge variant="outline">Locked</Badge> : null}
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-semibold tracking-normal">
              Draft answers
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Continue private drafts before publishing them to @{loaderData.drafts.profile.username}.
            </p>
          </div>
        </header>

        <DraftsList drafts={loaderData.drafts.drafts} />
      </div>
    </DashboardShell>
  );
}
