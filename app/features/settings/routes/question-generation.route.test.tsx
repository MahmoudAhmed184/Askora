import { describe, expect, it } from "vitest";

import { meta } from "~/features/settings/routes/question-generation.route";

describe("question generation settings route", () => {
  it("sets a specific settings title", () => {
    expect(meta()).toEqual([{ title: "Question generation settings | Askora" }]);
  });
});
