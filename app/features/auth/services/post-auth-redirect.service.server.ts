import type {
  CurrentSessionSummary
} from "~/features/auth/services/auth.service.server";;

export function getPostAuthRedirectPath(session?: CurrentSessionSummary) {
  if (session?.status !== "authenticated") {
    return "/login";
  }

  return session.profileStatus === "complete" ? "/feed" : "/setup";
}
