import { data, redirect } from "react-router";

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

export async function action({ request }: Route.ActionArgs) {
  const { requireCompletedProfileSession } = await import(
    "~/features/auth/auth.server"
  );
  const session = await requireCompletedProfileSession(request);

  if (session instanceof Response) {
    return session;
  }

  const result = await handleLikeAction({
    formData: await request.formData(),
    session,
  });

  if (isSuccessfulLikeAction(result)) {
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
