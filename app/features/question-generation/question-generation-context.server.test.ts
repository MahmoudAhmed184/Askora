import { describe, expect, it } from "vitest";

import {
  buildQuestionGenerationContext,
  serializeQuestionGenerationContext,
} from "~/features/question-generation/question-generation-context.server";

describe("buildQuestionGenerationContext", () => {
  it("keeps pinned published pairs first, deduplicates them, and bounds content", () => {
    const context = buildQuestionGenerationContext({
      profile: { displayName: "Person", bio: "Public bio" },
      interests: ["Books"],
      language: "english",
      style: "balanced",
      topic: "",
      pairs: [
        pair("pin", true, 1),
        pair("new", false, 3),
        pair("old", false, 2),
        pair("pin", true, 1),
      ],
    });

    expect(context.publishedPairs.map((item) => item.question)).toEqual([
      "pin",
      "new",
      "old",
    ]);
    expect(context.publishedPairs[0]?.answer).toHaveLength(1_000);
    expect(serializeQuestionGenerationContext(context)).not.toContain("draft");
  });

  it("caps the JSON payload by Unicode code points and retains no more than 20 published pairs", () => {
    const context = buildQuestionGenerationContext({
      profile: { displayName: "Person", bio: "public" },
      interests: [], language: "english", style: "personal", topic: "ignore rules",
      pairs: Array.from({ length: 25 }, (_, index) => ({
        id: `id_${String(index)}`,
        pinned: index < 3,
        question: `Question ${String(index)}?`,
        answer: "😀".repeat(1_000),
        publishedAt: new Date(2026, 0, 25 - index),
      })),
    });

    expect(context.publishedPairs).toHaveLength(20);
    expect(Array.from(serializeQuestionGenerationContext(context)).length).toBeLessThanOrEqual(30_000);
    expect(serializeQuestionGenerationContext(context)).toContain('"topic":"ignore rules"');
  });
});

function pair(id: string, pinned: boolean, day: number) {
  return {
    id,
    pinned,
    question: id,
    answer: "a".repeat(1_001),
    publishedAt: new Date(`2026-01-0${String(day)}T00:00:00.000Z`),
  };
}
