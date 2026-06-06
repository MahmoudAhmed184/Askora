import { data, redirect } from "react-router";

import { wantsToastResult } from "~/components/app/toast-result";
import { requireCompletedProfileSessionFromContext } from "~/features/auth/auth.server";
import {
  handlePublishedAnswerAction,
  type PublishedAnswerActionResult,
} from "~/features/answers/manage-published-answer.server";

import type { Route } from "./+types/published-answer-actions.route";

interface PublishedAnswerActionRouteData {
  publishedAnswer: PublishedAnswerActionResult;
}

export function loader() {
  return redirect("/dashboard");
}

export async function action({ context, params, request }: Route.ActionArgs) {
  const session = requireCompletedProfileSessionFromContext(context);

  if (session instanceof Response) {
    return session;
  }

  const formData = await request.formData();
  const result = await handlePublishedAnswerAction({
    formData,
    session,
    threadItemPublicId: params.threadItemPublicId,
  });

  if (isSuccessfulPublishedAnswerAction(result)) {
    if (wantsToastResult(formData)) {
      return data<PublishedAnswerActionRouteData>({ publishedAnswer: result });
    }

    return redirect(result.redirectTo);
  }

  return data<PublishedAnswerActionRouteData>(
    { publishedAnswer: result },
    { status: getPublishedAnswerActionResponseStatus(result) },
  );
}

function isSuccessfulPublishedAnswerAction(
  result: PublishedAnswerActionResult,
): result is Extract<
  PublishedAnswerActionResult,
  { status: "deleted" | "edited" | "pinned" | "unpublished" | "unpinned" }
> {
  return (
    result.status === "edited" ||
    result.status === "unpublished" ||
    result.status === "deleted" ||
    result.status === "pinned" ||
    result.status === "unpinned"
  );
}

function getPublishedAnswerActionResponseStatus(
  result: PublishedAnswerActionResult,
) {
  switch (result.status) {
    case "invalid":
      return 400;
    case "denied":
      if (result.reason === "not_found") {
        return 404;
      }

      if (result.reason === "pin_limit") {
        return 409;
      }

      return 403;
    case "deleted":
    case "edited":
    case "pinned":
    case "unpublished":
    case "unpinned":
      return 303;
  }
}
