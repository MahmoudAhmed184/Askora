import { describe, expect, it } from "vitest";

import { getQuestionDirection } from "~/lib/question-direction";

describe("getQuestionDirection", () => {
  it("uses the first strong letter in the question", () => {
    expect(getQuestionDirection("ما أخبارك؟")).toBe("rtl");
    expect(getQuestionDirection("What changed?")).toBe("ltr");
    expect(getQuestionDirection("123")).toBe("ltr");
  });
});
