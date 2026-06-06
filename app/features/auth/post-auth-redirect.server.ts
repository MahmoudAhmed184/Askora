import type { CurrentSessionSummary } from "~/features/auth/auth.server";

export function getPostAuthRedirectPath(session?: CurrentSessionSummary) {
  if (session?.status !== "authenticated") {
    return "/login";
  }

  return session.profileStatus === "complete" ? "/dashboard/feed" : "/setup";
}
