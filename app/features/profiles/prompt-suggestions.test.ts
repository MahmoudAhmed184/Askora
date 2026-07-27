import { describe, expect, it } from "vitest";

import { getPromptSuggestions } from "~/features/profiles/prompt-suggestions";

describe("getPromptSuggestions", () => {
  it("chooses four unique prompts deterministically from a larger pool", () => {
    const first = getPromptSuggestions("signed-timing-token");
    const second = getPromptSuggestions("signed-timing-token");

    expect(
      getPromptSuggestions("signed-timing-token", 100).length,
    ).toBeGreaterThan(4);
    expect(first).toHaveLength(4);
    expect(new Set(first)).toHaveLength(4);
    expect(second).toEqual(first);
  });

  it("varies the selected prompts when the page token changes", () => {
    expect(getPromptSuggestions("token-one")).not.toEqual(
      getPromptSuggestions("token-two"),
    );
  });
});
