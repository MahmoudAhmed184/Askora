import { data, redirect } from "react-router";

import { wantsToastResult } from "~/components/app/toast-result";
import { requireCompletedProfileSessionFromContext } from "~/features/auth/auth.server";
import {
  handleLikeAction,
  type LikeActionResult,
} from "~/features/social/like.action.server";

import type { Route } from "./+types/like.action.route";

interface LikeActionRouteData {
  like: LikeActionResult;
}

export function loader() {
  return redirect("/dashboard/feed");
}

export async function action({ context, request }: Route.ActionArgs) {
  const session = requireCompletedProfileSessionFromContext(context);

  if (session instanceof Response) {
    return session;
  }

  const formData = await request.formData();
  const result = await handleLikeAction({
    formData,
    session,
  });

  if (isSuccessfulLikeAction(result)) {
    if (wantsToastResult(formData)) {
      return data<LikeActionRouteData>({ like: result });
    }

    return redirect(result.redirectTo);
  }

  return data<LikeActionRouteData>(
    { like: result },
    { status: getLikeActionResponseStatus(result) },
  );
}

function isSuccessfulLikeAction(
  result: LikeActionResult,
): result is Extract<LikeActionResult, { status: "liked" | "unliked" }> {
  return result.status === "liked" || result.status === "unliked";
}

function getLikeActionResponseStatus(result: LikeActionResult) {
  switch (result.status) {
    case "invalid":
      return 400;
    case "denied":
      return result.reason === "not_found" ? 404 : 403;
    case "liked":
    case "unliked":
      return 303;
  }
}
