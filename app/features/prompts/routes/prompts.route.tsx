import { data, redirect, useActionData } from "react-router";

import { ActionToast } from "~/components/app/action-toast";
import { Badge } from "~/components/ui/badge";
import {
  isSessionSuspended,
  requireCompletedProfileSessionFromContext,
} from "~/features/auth/auth.server";
import { StarterPromptPicker } from "~/features/prompts/components/starter-prompt-picker";
import {
  createStarterPromptQuestion,
  type StarterPromptActionResult,
} from "~/features/prompts/starter-prompts.server";
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

  const result = await createStarterPromptQuestion({
    formData: await request.formData(),
    session,
  });

  if (result.status === "created") {
    return redirect(`/dashboard/answer/${result.questionPublicId}`);
  }

  return data<StarterPromptRouteActionData>(
    { starterPrompt: result },
    { status: getStarterPromptActionResponseStatus(result) },
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
      <div className="flex flex-col gap-6">
        <header className="rounded-3xl border bg-card p-6 text-card-foreground shadow-[var(--shadow-card)] sm:p-7">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Starter prompts</Badge>
            {loaderData.isSuspended ? <Badge variant="outline">Locked</Badge> : null}
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="font-serif text-4xl font-extrabold text-foreground">
              Pick a question to answer
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Casual, deep, funny, friends, work, school, and random questions for
              a first answer.
            </p>
          </div>
        </header>

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
