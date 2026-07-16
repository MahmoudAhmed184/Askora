import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { questions } from "~/db/schema/questions";

describe("questions schema", () => {
  it("indexes retained IP hashes used by moderation history", () => {
    const indexNames = getTableConfig(questions).indexes.map(
      (index) => index.config.name,
    );

    expect(indexNames).toContain("questions_ip_hash_idx");
  });
});
