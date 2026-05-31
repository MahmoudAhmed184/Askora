import { describe, expect, it } from "vitest";

import {
  mutedPhraseSubmissionSchema,
  normalizeMutedPhrase,
} from "~/features/inbox/inbox.schema";

describe("muted phrase normalization", () => {
  it("normalizes Unicode text and spacing", () => {
    expect(normalizeMutedPhrase("  Ｈello　مرحبا  WORLD  ")).toBe(
      "hello مرحبا world",
    );
  });

  it("validates Unicode muted phrases", () => {
    expect(
      mutedPhraseSubmissionSchema.parse({
        phrase: "  إساءة  متكررة  ",
      }),
    ).toEqual({
      phrase: "إساءة  متكررة",
      normalizedPhrase: "إساءة متكررة",
    });
  });
});
