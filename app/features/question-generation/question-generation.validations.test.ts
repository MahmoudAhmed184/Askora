import { describe, expect, it } from "vitest";

import {
  normalizeQuestionGenerationInterest,
  questionGenerationPreferencesSchema,
} from "~/features/question-generation/question-generation.validations";

describe("question generation preferences validation", () => {
  it("removes empty interests while preserving entered order", () => {
    const result = questionGenerationPreferencesSchema.parse({
      modelPreference: "auto",
      questionInterests: "Software engineering\n\nBooks\n",
    });

    expect(result.questionInterests).toEqual([
      "Software engineering",
      "Books",
    ]);
  });

  it("rejects interests duplicated after Unicode normalization and case folding", () => {
    const result = questionGenerationPreferencesSchema.safeParse({
      modelPreference: "auto",
      questionInterests: "Café\nCafé",
    });

    expect(result.success).toBe(false);
  });

  it("enforces the private interest limit and per-interest length", () => {
    const tooMany = Array.from({ length: 13 }, (_, index) => `Topic ${String(index)}`).join("\n");

    expect(
      questionGenerationPreferencesSchema.safeParse({
        modelPreference: "auto",
        questionInterests: tooMany,
      }).success,
    ).toBe(false);
    expect(
      questionGenerationPreferencesSchema.safeParse({
        modelPreference: "auto",
        questionInterests: "x",
      }).success,
    ).toBe(false);
  });

  it("normalizes comparisons without changing the stored interest wording", () => {
    expect(normalizeQuestionGenerationInterest("  SOFTware  ")).toBe(
      "software",
    );
  });
});
