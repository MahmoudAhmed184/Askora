import { describe, expect, it } from "vitest";

import {
  INLINE_FOLLOW_UP_FIELD,
  INLINE_FOLLOW_UP_VALUE,
  isInlineFollowUpSubmission,
} from "~/features/threads/inline-follow-up";

describe("isInlineFollowUpSubmission", () => {
  it("recognizes the explicit inline discriminator", () => {
    const formData = new FormData();

    formData.set(INLINE_FOLLOW_UP_FIELD, INLINE_FOLLOW_UP_VALUE);

    expect(isInlineFollowUpSubmission(formData)).toBe(true);
  });

  it("treats an ordinary form submission as a redirect flow", () => {
    expect(isInlineFollowUpSubmission(new FormData())).toBe(false);

    const wrongValue = new FormData();

    wrongValue.set(INLINE_FOLLOW_UP_FIELD, "page");

    expect(isInlineFollowUpSubmission(wrongValue)).toBe(false);
  });
});
