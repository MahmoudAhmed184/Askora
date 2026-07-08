import { describe, expect, it } from "vitest";

import {
  mutedPhraseSubmissionSchema,
  normalizeMutedPhrase,
} from "~/features/moderation/validations/moderation.validations";

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

  it("rejects empty and overlong muted phrases", () => {
    expect(() =>
      mutedPhraseSubmissionSchema.parse({ phrase: "  " }),
    ).toThrow(/enter a muted phrase/i);

    expect(() =>
      mutedPhraseSubmissionSchema.parse({ phrase: "x".repeat(101) }),
    ).toThrow(/100 characters/i);
  });
});
