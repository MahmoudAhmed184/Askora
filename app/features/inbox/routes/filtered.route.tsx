import { data, useActionData } from "react-router";

import type { Route } from "./+types/filtered.route";
import { ActionToast } from "~/components/app/action-toast";
import {
  isSessionSuspended,
  requireCompletedProfileSessionFromContext,
} from "~/features/auth/auth.server";
import { InboxList } from "~/features/inbox/components/inbox-list";
import { InboxWorkflowShell } from "~/features/inbox/components/inbox-workflow-nav";
import {
  handleInboxAction,
  type InboxActionResult,
} from "~/features/inbox/inbox-actions.server";
import { loadInboxFolder } from "~/features/inbox/inbox.loader.server";

interface FilteredRouteActionData {
  inbox: InboxActionResult;
}

export async function loader({ context }: Route.LoaderArgs) {
  const session = requireCompletedProfileSessionFromContext(context);

  if (session instanceof Response) {
    return session;
  }

  return {
    folder: await loadInboxFolder({ folder: "filtered", session }),
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
    <InboxWorkflowShell
      active="filtered"
      counts={{ filtered: loaderData.folder.questions.length }}
      description="Questions held outside the inbox by muted phrases or safety checks."
      locked={loaderData.isSuspended}
    >
      <ActionToast
        message={getInboxErrorToastMessage(actionData?.inbox)}
        tone="error"
        trigger={actionData?.inbox}
      />

      <InboxList
        disabled={loaderData.isSuspended}
        folder="filtered"
        questions={loaderData.folder.questions}
      />
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
