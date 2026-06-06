import { data, redirect } from "react-router";

import { wantsToastResult } from "~/components/app/toast-result";
import { requireCompletedProfileSessionFromContext } from "~/features/auth/auth.server";
import {
  handleFollowAction,
  type FollowActionResult,
} from "~/features/social/follow.action.server";

import type { Route } from "./+types/follow.action.route";

interface FollowActionRouteData {
  follow: FollowActionResult;
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
  const result = await handleFollowAction({
    formData,
    session,
  });

  if (isSuccessfulFollowAction(result)) {
    if (wantsToastResult(formData)) {
      return data<FollowActionRouteData>({ follow: result });
    }

    return redirect(result.redirectTo);
  }

  return data<FollowActionRouteData>(
    { follow: result },
    { status: getFollowActionResponseStatus(result) },
  );
}

function isSuccessfulFollowAction(
  result: FollowActionResult,
): result is Extract<FollowActionResult, { status: "followed" | "unfollowed" }> {
  return result.status === "followed" || result.status === "unfollowed";
}

function getFollowActionResponseStatus(result: FollowActionResult) {
  switch (result.status) {
    case "invalid":
      return 400;
    case "denied":
      return result.reason === "not_found" ? 404 : 403;
    case "followed":
    case "unfollowed":
      return 303;
  }
}
