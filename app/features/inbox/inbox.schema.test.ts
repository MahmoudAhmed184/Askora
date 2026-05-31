import { describe, expect, it } from "vitest";

import {
  mutedPhraseSubmissionSchema,
  normalizeMutedPhrase,
} from "~/features/inbox/inbox.schema";

describe("inbox moderation schema exports", () => {
  it("re-exports muted phrase validation from moderation", () => {
    expect(normalizeMutedPhrase("  Ｈello　WORLD  ")).toBe("hello world");
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
