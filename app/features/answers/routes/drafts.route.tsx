import { data, useActionData } from "react-router";

import { ActionToast } from "~/components/shared/action-toast/action-toast";
import { DraftsList } from "~/features/answers/components/drafts-list";
import { loadDraftAnswers } from "~/features/answers/services/answer.service.server";
import {
  isSessionSuspended,
  requireCompletedProfileSessionFromContext,
} from "~/features/auth/services/auth.service.server";
import { InboxWorkflowShell } from "~/features/inbox/components/inbox-workflow-nav";
import {
  handleInboxAction,
  type InboxActionResult,
} from "~/features/inbox/services/inbox-actions.service.server";

import type { Route } from "./+types/drafts.route";

export async function loader({ context }: Route.LoaderArgs) {
  const session = requireCompletedProfileSessionFromContext(context);

  if (session instanceof Response) {
    return session;
  }

  return {
    drafts: await loadDraftAnswers({ session }),
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

  return data<{ draft: InboxActionResult }>(
    { draft: result },
    { status: getDraftActionResponseStatus(result) },
  );
}

export function meta() {
  return [{ title: "Drafts | Askora" }];
}

export default function DraftsRoute({ loaderData }: Route.ComponentProps) {
  const actionData = useActionData<typeof action>();

  return (
    <InboxWorkflowShell
      active="drafts"
      counts={{ drafts: loaderData.drafts.drafts.length }}
      description={`Continue private drafts before publishing them to @${loaderData.drafts.profile.username}.`}
      locked={loaderData.isSuspended}
    >
      <ActionToast
        message={getDraftActionMessage(actionData?.draft)}
        tone={actionData?.draft.status === "deleted" ? "success" : "error"}
        trigger={actionData?.draft}
      />
      <DraftsList
        disabled={loaderData.isSuspended}
        drafts={loaderData.drafts.drafts}
      />
    </InboxWorkflowShell>
  );
}

function getDraftActionResponseStatus(result: InboxActionResult) {
  if (result.status === "invalid") {
    return 400;
  }

  if (result.status === "denied") {
    return result.reason === "not_found" ? 404 : 409;
  }

  return 200;
}

function getDraftActionMessage(result: InboxActionResult | undefined) {
  if (result === undefined) {
    return undefined;
  }

  if (result.status === "invalid" || result.status === "denied") {
    return result.formError;
  }

  return result.status === "deleted" ? "Draft discarded." : "Draft updated.";
}
