import { data, redirect, useActionData } from "react-router";

import { DashboardShell } from "~/components/app/dashboard-shell";
import { Badge } from "~/components/ui/badge";
import { AnswerEditor } from "~/features/answers/components/answer-editor";
import {
  handleAnswerSubmission,
  loadAnswerEditor,
  type AnswerActionResult,
} from "~/features/answers/answer.server";

import type { Route } from "./+types/answer.route";

interface AnswerRouteActionData {
  answer: AnswerActionResult;
}

export async function loader({ params, request }: Route.LoaderArgs) {
  const { isSessionSuspended, requireCompletedProfileSession } = await import(
    "~/features/auth/auth.server"
  );
  const session = await requireCompletedProfileSession(request);

  if (session instanceof Response) {
    return session;
  }

  const result = await loadAnswerEditor({
    questionPublicId: params.questionId,
    session,
  });

  if (result.status === "not_found") {
    return data(
      {
        status: "not_found" as const,
      },
      { status: 404 },
    );
  }

  return {
    status: "found" as const,
    editor: result.editor,
    isSuspended: isSessionSuspended(session),
  };
}

export async function action({ params, request }: Route.ActionArgs) {
  const { requireCompletedProfileSession } = await import(
    "~/features/auth/auth.server"
  );
  const session = await requireCompletedProfileSession(request);

  if (session instanceof Response) {
    return session;
  }

  const result = await handleAnswerSubmission({
    formData: await request.formData(),
    questionPublicId: params.questionId,
    session,
  });

  if (result.status === "published") {
    return redirect(result.redirectTo);
  }

  return data<AnswerRouteActionData>(
    { answer: result },
    { status: getAnswerActionResponseStatus(result) },
  );
}

export function meta() {
  return [{ title: "Answer | qna-platform" }];
}

export default function AnswerRoute({ loaderData }: Route.ComponentProps) {
  const actionData = useActionData<typeof action>();

  if (loaderData.status === "not_found") {
    return (
      <DashboardShell>
        <div className="flex flex-col gap-3 border-b pb-5">
          <Badge variant="secondary">Answer</Badge>
          <h1 className="text-3xl font-semibold tracking-normal">
            Question not found
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            This question is not available for answering.
          </p>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-3 border-b pb-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Answer</Badge>
            {loaderData.isSuspended ? <Badge variant="outline">Locked</Badge> : null}
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-semibold tracking-normal">
              Draft and publish
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Answers publish as plain text on @{loaderData.editor.profile.username}.
            </p>
          </div>
        </header>

        <AnswerEditor
          actionResult={actionData?.answer}
          disabled={loaderData.isSuspended}
          editor={loaderData.editor}
        />
      </div>
    </DashboardShell>
  );
}

function getAnswerActionResponseStatus(result: AnswerActionResult) {
  switch (result.status) {
    case "draft_saved":
      return 200;
    case "published":
      return 303;
    case "invalid":
      return 400;
    case "denied":
      if (result.reason === "not_found") {
        return 404;
      }

      if (result.reason === "closed") {
        return 409;
      }

      return 403;
  }
}
