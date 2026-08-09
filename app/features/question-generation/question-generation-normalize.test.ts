import { describe, expect, it } from "vitest";

import { normalizeQuestionGenerationText } from "~/features/question-generation/question-generation-normalize";

describe("normalizeQuestionGenerationText", () => {
  it("normalizes Unicode, whitespace, Arabic variants, punctuation, and final question marks", () => {
    expect(normalizeQuestionGenerationText("  أَهلاً،  بالعالَم؟  ")).toBe(
      "اَهلاً, بالعالَم",
    );
    expect(normalizeQuestionGenerationText("Same   question?" )).toBe("same question");
  });
});
