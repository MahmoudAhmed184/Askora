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

  it("keeps optional safety metadata internally consistent", () => {
    const checks = getTableConfig(questions).checks.map((check) => check.name);

    expect(questions.safetyFingerprintHash.notNull).toBe(false);
    expect(questions.safetyMetadataRetainUntil.notNull).toBe(false);
    expect(checks).toContain("questions_safety_metadata_pair_check");
  });
});
