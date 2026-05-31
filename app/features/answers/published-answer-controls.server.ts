import type { CurrentSessionSummary } from "~/features/auth/auth.server";
import {
  hiddenPublishedAnswerControls,
  type PublishedAnswerControlState,
} from "~/features/answers/published-answer-controls";

export {
  hiddenPublishedAnswerControls,
  type PublishedAnswerControlState,
} from "~/features/answers/published-answer-controls";

export interface PublishedAnswerOwner {
  id: string;
  userId: string;
}

export function getPublishedAnswerControlState({
  owner,
  session,
}: {
  owner: PublishedAnswerOwner;
  session: CurrentSessionSummary;
}): PublishedAnswerControlState {
  if (
    session.status !== "authenticated" ||
    session.profileStatus !== "complete" ||
    session.profile.id !== owner.id ||
    session.user.id !== owner.userId
  ) {
    return hiddenPublishedAnswerControls;
  }

  return {
    canManage: true,
    disabled: session.suspensionStatus === "active",
  };
}
