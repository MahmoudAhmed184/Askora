import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("question-generation repository query shapes", () => {
  it("bounds public context and serializes persistence behind the owned-profile lock", async () => {
    const source = await readFile(
      resolve("app/features/question-generation/question-generation.repository.server.ts"),
      "utf8",
    );

    expect(source).toContain(".limit(20)");
    expect(source).toContain(".for(\"update\")");
    expect(source).toContain("database.transaction");
    expect(source).toContain("new QuestionGenerationError(\"duplicate\")");
    expect(source).toContain("threads.ownerProfileId, profileId");
  });
});
