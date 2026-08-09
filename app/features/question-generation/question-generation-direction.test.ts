import { describe, expect, it } from "vitest";

import { getQuestionGenerationDirection } from "~/features/question-generation/question-generation-direction";

describe("question generation display direction", () => {
  it("uses the stored Arabic language even when text starts with Latin", () => {
    expect(
      getQuestionGenerationDirection(
        "modern_standard_arabic",
        "AI ما الفكرة التي غيّرت طريقة تعاملك؟",
      ),
    ).toBe("rtl");
  });

  it("falls back to the first strong character for non-generated rows", () => {
    expect(getQuestionGenerationDirection(null, "ما أخبارك؟")).toBe("rtl");
    expect(getQuestionGenerationDirection(undefined, "What changed?")).toBe("ltr");
    expect(getQuestionGenerationDirection(undefined, "123")).toBe("ltr");
  });
});
