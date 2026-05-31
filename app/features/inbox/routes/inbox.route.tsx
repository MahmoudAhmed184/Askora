import { data, useActionData } from "react-router";

import type { Route } from "./+types/inbox.route";
import { DashboardShell } from "~/components/app/dashboard-shell";
import { Badge } from "~/components/ui/badge";
import { InboxList } from "~/features/inbox/components/inbox-list";
import {
  handleInboxAction,
  type InboxActionResult,
} from "~/features/inbox/inbox-actions.server";
import { loadInboxFolder } from "~/features/inbox/inbox.loader.server";

interface InboxRouteActionData {
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
    folder: await loadInboxFolder({ folder: "inbox", session }),
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

  return data<InboxRouteActionData>(
    { inbox: result },
    { status: getInboxActionResponseStatus(result) },
  );
}

export function meta() {
  return [{ title: "Inbox | qna-platform" }];
}

export default function InboxRoute({ loaderData }: Route.ComponentProps) {
  const actionData = useActionData<typeof action>();

  return (
    <DashboardShell>
      <InboxFolderPage
        actionResult={actionData?.inbox}
        count={loaderData.folder.questions.length}
        description="Private questions that need attention."
        disabled={loaderData.isSuspended}
        folder="inbox"
        questions={loaderData.folder.questions}
        title="Inbox"
      />
    </DashboardShell>
  );
}

function InboxFolderPage({
  actionResult,
  count,
  description,
  disabled,
  folder,
  questions,
  title,
}: {
  actionResult: InboxActionResult | undefined;
  count: number;
  description: string;
  disabled: boolean;
  folder: "inbox";
  questions: Route.ComponentProps["loaderData"]["folder"]["questions"];
  title: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 border-b pb-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{title}</Badge>
          <Badge variant="outline">{count} total</Badge>
          {disabled ? <Badge variant="outline">Locked</Badge> : null}
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-normal">{title}</h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        </div>
      </header>

      {actionResult?.status === "invalid" || actionResult?.status === "denied" ? (
        <p className="text-sm leading-6 text-destructive" role="alert">
          {actionResult.formError}
        </p>
      ) : null}

      <InboxList disabled={disabled} folder={folder} questions={questions} />
    </div>
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
