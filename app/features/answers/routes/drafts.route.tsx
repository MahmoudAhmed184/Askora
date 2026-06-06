import { DraftsList } from "~/features/answers/components/drafts-list";
import { loadDraftAnswers } from "~/features/answers/answer.server";
import {
  isSessionSuspended,
  requireCompletedProfileSessionFromContext,
} from "~/features/auth/auth.server";
import { InboxWorkflowShell } from "~/features/inbox/components/inbox-workflow-nav";

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

export function meta() {
  return [{ title: "Drafts | qna-platform" }];
}

export default function DraftsRoute({ loaderData }: Route.ComponentProps) {
  return (
    <InboxWorkflowShell
      active="drafts"
      counts={{ drafts: loaderData.drafts.drafts.length }}
      description={`Continue private drafts before publishing them to @${loaderData.drafts.profile.username}.`}
      locked={loaderData.isSuspended}
    >
      <DraftsList drafts={loaderData.drafts.drafts} />
    </InboxWorkflowShell>
  );
}
