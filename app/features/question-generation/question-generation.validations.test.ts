import { describe, expect, it } from "vitest";

import {
  normalizeQuestionGenerationInterest,
  generatedQuestionBatchSchema,
  questionGenerationPreferencesSchema,
  questionGenerationRequestSchema,
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

  it("accepts only the generation request controls and strict output shape", () => {
    expect(
      questionGenerationRequestSchema.parse({
        topic: "  Career  ",
        language: "english",
        style: "balanced",
        requestedCount: 5,
      }),
    ).toMatchObject({ topic: "Career", requestedCount: 5 });
    expect(questionGenerationRequestSchema.safeParse({
      topic: "x".repeat(161), language: "english", style: "balanced", requestedCount: 4,
    }).success).toBe(false);
    expect(questionGenerationRequestSchema.safeParse({
      language: "other", style: "balanced", requestedCount: 3,
    }).success).toBe(false);
    expect(generatedQuestionBatchSchema.safeParse({
      questions: [{ text: "Question?", extra: "no" }],
    }).success).toBe(false);
  });

  it.each([
    "egyptian_arabic",
    "modern_standard_arabic",
    "english",
  ])("accepts supported language %s", (language) => {
    expect(questionGenerationRequestSchema.safeParse({
      topic: "", language, style: "balanced", requestedCount: 3,
    }).success).toBe(true);
  });

  it.each([
    "balanced", "deep_reflective", "professional", "personal", "light_fun", "surprise_me",
  ])("accepts supported style %s", (style) => {
    expect(questionGenerationRequestSchema.safeParse({
      topic: "", language: "english", style, requestedCount: 10,
    }).success).toBe(true);
  });
});
