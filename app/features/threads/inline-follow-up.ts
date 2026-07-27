import type { FollowUpFlash } from "~/features/threads/types/threads.types";

export const INLINE_FOLLOW_UP_FIELD = "submission";
export const INLINE_FOLLOW_UP_VALUE = "inline";

export interface InlineFollowUpActionData {
  followUp: FollowUpFlash;
  timingToken?: string;
}

export function isInlineFollowUpSubmission(formData: FormData) {
  return formData.get(INLINE_FOLLOW_UP_FIELD) === INLINE_FOLLOW_UP_VALUE;
}
