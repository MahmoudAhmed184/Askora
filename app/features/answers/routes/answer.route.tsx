import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { data, Link, redirect, useActionData } from "react-router";

import { Button } from "~/components/ui/button/button";
import { UnavailableState } from "~/components/shared/unavailable-state/unavailable-state";
import { AnswerEditor } from "~/features/answers/components/answer-editor";
import {
  handleAnswerSubmission,
  loadAnswerEditor,
  type AnswerActionResult,
} from "~/features/answers/services/answer.service.server";
import {
  isSessionSuspended,
  requireCompletedProfileSessionFromContext,
} from "~/features/auth/services/auth.service.server";

import type { Route } from "./+types/answer.route";

interface AnswerRouteActionData {
  answer: AnswerActionResult;
}

export async function loader({ context, params, request }: Route.LoaderArgs) {
  const session = requireCompletedProfileSessionFromContext(context);

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
    closeHref: getAnswerEditorCloseHref(request),
    status: "found" as const,
    editor: result.editor,
    isSuspended: isSessionSuspended(session),
  };
}

export async function action({ context, params, request }: Route.ActionArgs) {
  const session = requireCompletedProfileSessionFromContext(context);

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
  const [isDirty, setIsDirty] = useState(false);

  if (loaderData.status === "not_found") {
    return (
      <UnavailableState
        action={
          <Button asChild variant="outline">
            <Link to="/inbox">
              <ArrowLeft data-icon="inline-start" />
              Back to inbox
            </Link>
          </Button>
        }
        description="This question is not available for answering. It may have been removed or already handled."
        title="Question not found"
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-hidden px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-6 sm:px-6 sm:pb-28 sm:pt-10">
      <Link
        aria-label="Dismiss answer editor"
        className="absolute inset-0 bg-background/92"
        onClick={(event) => {
          if (
            isDirty &&
            !window.confirm(
              "Discard this answer? Unsaved changes will be lost.",
            )
          ) {
            event.preventDefault();
          }
        }}
        to={loaderData.closeHref}
      />
      <div className="relative z-10 flex max-h-[calc(100svh_-_9rem_-_env(safe-area-inset-bottom))] w-full max-w-[53rem] sm:max-h-[calc(100svh_-_9rem)]">
        <AnswerEditor
          actionResult={actionData?.answer}
          disabled={loaderData.isSuspended}
          editor={loaderData.editor}
          key={loaderData.editor.question.publicId}
          onDirtyChange={setIsDirty}
        />
      </div>
    </div>
  );
}

function getAnswerEditorCloseHref(request: Request) {
  const returnTo = new URL(request.url).searchParams.get("returnTo");

  if (
    returnTo === null ||
    !returnTo.startsWith("/") ||
    returnTo.startsWith("//")
  ) {
    return "/inbox";
  }

  return returnTo;
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

      if (result.reason === "thread_full") {
        return 409;
      }

      return 403;
  }
}
