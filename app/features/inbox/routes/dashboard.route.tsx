import { redirect } from "react-router";

import { requireCompletedProfileSessionFromContext } from "~/features/auth/auth.server";

import type { Route } from "./+types/dashboard.route";

export function loader({ context }: Route.LoaderArgs) {
  const session = requireCompletedProfileSessionFromContext(context);

  if (session instanceof Response) {
    return session;
  }

  return redirect("/dashboard/feed");
}

export function meta() {
  return [{ title: "Feed | qna-platform" }];
}

export default function DashboardRoute() {
  return null;
}
