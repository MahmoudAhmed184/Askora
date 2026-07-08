import { data, useActionData } from "react-router";

import type { Route } from "./+types/inbox.route";
import { ActionToast } from "~/components/shared/action-toast/action-toast";
import {
  isSessionSuspended,
  requireCompletedProfileSessionFromContext,
} from "~/features/auth/services/auth.service.server";
import { InboxList } from "~/features/inbox/components/inbox-list";
import { InboxWorkflowShell } from "~/features/inbox/components/inbox-workflow-nav";
import {
  handleInboxAction,
  type InboxActionResult,
} from "~/features/inbox/services/inbox-actions.service.server";
import { loadInboxFolder } from "~/features/inbox/queries/inbox.queries.server";

interface InboxRouteActionData {
  inbox: InboxActionResult;
}

export async function loader({ context }: Route.LoaderArgs) {
  const session = requireCompletedProfileSessionFromContext(context);

  if (session instanceof Response) {
    return session;
  }

  return {
    folder: await loadInboxFolder({ folder: "inbox", session }),
    isSuspended: isSessionSuspended(session),
  };
}

export async function action({ context, request }: Route.ActionArgs) {
  const session = requireCompletedProfileSessionFromContext(context);

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
    <InboxFolderPage
      actionResult={actionData?.inbox}
      count={loaderData.folder.questions.length}
      description="Private questions that need attention."
      disabled={loaderData.isSuspended}
      folder="inbox"
      questions={loaderData.folder.questions}
    />
  );
}

function InboxFolderPage({
  actionResult,
  count,
  description,
  disabled,
  folder,
  questions,
}: {
  actionResult: InboxActionResult | undefined;
  count: number;
  description: string;
  disabled: boolean;
  folder: "inbox";
  questions: Route.ComponentProps["loaderData"]["folder"]["questions"];
}) {
  return (
    <InboxWorkflowShell
      active="inbox"
      counts={{ inbox: count }}
      description={description}
      locked={disabled}
    >
      <ActionToast
        message={getInboxErrorToastMessage(actionResult)}
        tone="error"
        trigger={actionResult}
      />

      <InboxList disabled={disabled} folder={folder} questions={questions} />
    </InboxWorkflowShell>
  );
}

function getInboxErrorToastMessage(result: InboxActionResult | undefined) {
  if (result?.status === "invalid" || result?.status === "denied") {
    return result.formError;
  }

  return undefined;
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
