import { data, useActionData } from "react-router";

import type { Route } from "./+types/filtered.route";
import { DashboardShell } from "~/components/app/dashboard-shell";
import { Badge } from "~/components/ui/badge";
import { InboxList } from "~/features/inbox/components/inbox-list";
import {
  handleInboxAction,
  type InboxActionResult,
} from "~/features/inbox/inbox-actions.server";
import { loadInboxFolder } from "~/features/inbox/inbox.loader.server";

interface FilteredRouteActionData {
  inbox: InboxActionResult;
}

export async function loader({ request }: Route.LoaderArgs) {
  const { isSessionSuspended, requireCompletedProfileSession } = await import(
    "~/features/auth/auth.server"
  );
  const session = await requireCompletedProfileSession(request);

  if (session instanceof Response) {
    return session;
  }

  return {
    folder: await loadInboxFolder({ folder: "filtered", session }),
    isSuspended: isSessionSuspended(session),
  };
}

export async function action({ request }: Route.ActionArgs) {
  const { requireCompletedProfileSession } = await import(
    "~/features/auth/auth.server"
  );
  const session = await requireCompletedProfileSession(request);

  if (session instanceof Response) {
    return session;
  }

  const result = await handleInboxAction({
    formData: await request.formData(),
    session,
  });

  return data<FilteredRouteActionData>(
    { inbox: result },
    { status: getInboxActionResponseStatus(result) },
  );
}

export function meta() {
  return [{ title: "Filtered questions | qna-platform" }];
}

export default function FilteredRoute({ loaderData }: Route.ComponentProps) {
  const actionData = useActionData<typeof action>();

  return (
    <DashboardShell>
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-3 border-b pb-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Filtered</Badge>
            <Badge variant="outline">{loaderData.folder.questions.length} total</Badge>
            {loaderData.isSuspended ? <Badge variant="outline">Locked</Badge> : null}
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-semibold tracking-normal">
              Filtered questions
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Questions held outside the inbox by muted phrases or safety checks.
            </p>
          </div>
        </header>

        {actionData?.inbox.status === "invalid" ||
        actionData?.inbox.status === "denied" ? (
          <p className="text-sm leading-6 text-destructive" role="alert">
            {actionData.inbox.formError}
          </p>
        ) : null}

        <InboxList
          disabled={loaderData.isSuspended}
          folder="filtered"
          questions={loaderData.folder.questions}
        />
      </div>
    </DashboardShell>
  );
}

function getInboxActionResponseStatus(result: InboxActionResult) {
  switch (result.status) {
    case "deleted":
    case "restored":
    case "blocked":
    case "reported":
    case "reported_and_blocked":
      return 200;
    case "invalid":
      return 400;
    case "denied":
      if (result.reason === "not_found") {
        return 404;
      }

      if (result.reason === "already_deleted" || result.reason === "closed") {
        return 409;
      }

      return 403;
  }
}
