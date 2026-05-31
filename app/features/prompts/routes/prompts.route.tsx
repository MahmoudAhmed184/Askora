import { data, redirect, useActionData } from "react-router";

import { DashboardShell } from "~/components/app/dashboard-shell";
import { Badge } from "~/components/ui/badge";
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

export async function loader({ request }: Route.LoaderArgs) {
  const { isSessionSuspended, requireCompletedProfileSession } = await import(
    "~/features/auth/auth.server"
  );
  const session = await requireCompletedProfileSession(request);

  if (session instanceof Response) {
    return session;
  }

  return {
    categories: starterPromptCategories,
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
    <DashboardShell>
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-3 border-b pb-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Starter prompts</Badge>
            {loaderData.isSuspended ? <Badge variant="outline">Locked</Badge> : null}
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-semibold tracking-normal">
              Pick a question to answer
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Casual, deep, funny, friends, work, school, and random questions for
              a first answer.
            </p>
          </div>
        </header>

        {actionData?.starterPrompt.status === "invalid" ||
        actionData?.starterPrompt.status === "denied" ? (
          <p className="text-sm leading-6 text-destructive" role="alert">
            {actionData.starterPrompt.formError}
          </p>
        ) : null}

        <StarterPromptPicker
          categories={loaderData.categories}
          disabled={loaderData.isSuspended}
        />
      </div>
    </DashboardShell>
  );
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
