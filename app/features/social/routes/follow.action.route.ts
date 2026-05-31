import { data, redirect } from "react-router";

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

export async function action({ request }: Route.ActionArgs) {
  const { requireCompletedProfileSession } = await import(
    "~/features/auth/auth.server"
  );
  const session = await requireCompletedProfileSession(request);

  if (session instanceof Response) {
    return session;
  }

  const result = await handleFollowAction({
    formData: await request.formData(),
    session,
  });

  if (isSuccessfulFollowAction(result)) {
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
