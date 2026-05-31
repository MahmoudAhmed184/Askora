import type { CurrentSessionSummary } from "~/features/auth/auth.server";

export function getPostAuthRedirectPath(_session?: CurrentSessionSummary) {
  // Slice 3 can branch here once profile setup and dashboard routes exist.
  return "/";
}
