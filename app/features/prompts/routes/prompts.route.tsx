import { data, redirect, useActionData } from "react-router";

import { ActionToast } from "~/components/shared/action-toast/action-toast";
import { PageHeader } from "~/components/shared/page-header/page-header";
import { Badge } from "~/components/ui/badge/badge";
import {
  isSessionSuspended,
  requireCompletedProfileSessionFromContext,
} from "~/features/auth/services/auth.service.server";
import { StarterPromptPicker } from "~/features/prompts/components/starter-prompt-picker";
import {
  createStarterPromptQuestion,
  type StarterPromptActionResult,
} from "~/features/prompts/services/starter-prompts.service.server";
import { starterPromptCategories } from "~/features/prompts/starter-prompts";

import type { Route } from "./+types/prompts.route";

interface StarterPromptRouteActionData {
  starterPrompt: StarterPromptActionResult;
}

export function loader({ context }: Route.LoaderArgs) {
  const session = requireCompletedProfileSessionFromContext(context);

  if (session instanceof Response) {
    return session;
  }

  return {
    categories: starterPromptCategories,
    isSuspended: isSessionSuspended(session),
  };
}

export async function action({ context, request }: Route.ActionArgs) {
  const session = requireCompletedProfileSessionFromContext(context);

  if (session instanceof Response) {
    return session;
  }

  const formData = await request.formData();
  const result = await createStarterPromptQuestion({
    formData,
    session,
  });

  if (result.status === "created" && formData.get("submissionMode") !== "contextual") {
    return redirect(`/answer/${result.questionPublicId}`);
  }

  return data<StarterPromptRouteActionData>(
    { starterPrompt: result },
    {
      status:
        result.status === "created" &&
        formData.get("submissionMode") === "contextual"
          ? 200
          : getStarterPromptActionResponseStatus(result),
    },
  );
}

export function meta() {
  return [{ title: "Starter prompts | qna-platform" }];
}

export default function PromptsRoute({ loaderData }: Route.ComponentProps) {
  const actionData = useActionData<typeof action>();

  return (
    <>
      <ActionToast
        message={getStarterPromptToastMessage(actionData?.starterPrompt)}
        tone="error"
        trigger={actionData?.starterPrompt}
      />
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <PageHeader
          actions={
            loaderData.isSuspended ? (
              <Badge variant="outline">Locked</Badge>
            ) : undefined
          }
          description="Casual, deep, funny, friends, work, school, and random questions for a first answer."
          title="Prompts"
        />

        <StarterPromptPicker
          categories={loaderData.categories}
          disabled={loaderData.isSuspended}
        />
      </div>
    </>
  );
}

function getStarterPromptToastMessage(
  result: StarterPromptActionResult | undefined,
) {
  if (result?.status === "invalid" || result?.status === "denied") {
    return result.formError;
  }

  return undefined;
}

function getStarterPromptActionResponseStatus(
  result: StarterPromptActionResult,
) {
  switch (result.status) {
    case "created":
      return 303;
    case "invalid":
      return 400;
    case "denied":
      return 403;
  }
}
