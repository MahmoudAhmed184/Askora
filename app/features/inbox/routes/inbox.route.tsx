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
  InboxQuestionGenerationDialog,
} from "~/features/question-generation/components/inbox-question-generation-dialog";
import { QUESTION_GENERATION_MODELS } from "~/features/question-generation/question-generation.constants";
import { loadQuestionGenerationSettings } from "~/features/question-generation/question-generation-settings.service.server";
import {
  handleInboxAction,
  type InboxActionResult,
} from "~/features/inbox/services/inbox-actions.service.server";
import { loadInboxFolder } from "~/features/inbox/queries/inbox.queries.server";
import { handleInboxGenerationAction } from "~/features/inbox/services/inbox-generation-action.server";

interface InboxRouteActionData {
  inbox: InboxActionResult;
  generation?: never;
}

export async function loader({ context }: Route.LoaderArgs) {
  const session = requireCompletedProfileSessionFromContext(context);

  if (session instanceof Response) {
    return session;
  }

  const [folder, settings] = await Promise.all([
    loadInboxFolder({ folder: "inbox", session }),
    loadQuestionGenerationSettings({ session }),
  ]);

  return {
    folder,
    generation: {
      activeModelLabel: getActiveModelLabel(settings.modelPreference),
      connected: settings.connected,
      disclosureAcknowledged: settings.disclosureAcknowledged,
    },
    isSuspended: isSessionSuspended(session),
  };
}

export async function action({ context, request }: Route.ActionArgs) {
  const session = requireCompletedProfileSessionFromContext(context);

  if (session instanceof Response) {
    return session;
  }

  const formData = await request.formData();

  if (formData.get("intent") === "generate_questions") {
    return handleInboxGenerationAction({ formData, session });
  }

  const result = await handleInboxAction({ formData, session });

  return data<InboxRouteActionData>(
    { inbox: result },
    { status: getInboxActionResponseStatus(result) },
  );
}

export function meta() {
  return [{ title: "Inbox | Askora" }];
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
      generation={loaderData.generation}
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
  generation,
  questions,
}: {
  actionResult: InboxActionResult | undefined;
  count: number;
  description: string;
  disabled: boolean;
  folder: "inbox";
  generation: Route.ComponentProps["loaderData"]["generation"];
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

      <InboxQuestionGenerationDialog
        availability={generation}
        disabled={disabled}
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

function getActiveModelLabel(model: string) {
  if (model === QUESTION_GENERATION_MODELS.auto) return "Auto";
  if (model === QUESTION_GENERATION_MODELS.gemini36Flash) return "Gemini 3.6 Flash";
  return "Gemini 3.1 Flash-Lite";
}
