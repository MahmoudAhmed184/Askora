import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { questionSourceEnum, questions } from "~/db/schema/questions";

describe("questions schema", () => {
  it("indexes retained IP hashes used by moderation history", () => {
    const indexNames = getTableConfig(questions).indexes.map(
      (index) => index.config.name,
    );

    expect(indexNames).toContain("questions_ip_hash_idx");
  });

  it("enforces AI provenance and source-specific safety metadata", () => {
    const checks = getTableConfig(questions).checks.map((check) => check.name);

    expect(questionSourceEnum.enumValues).toEqual([
      "public_profile",
      "ai_generated",
    ]);
    expect(questions.generationBatchId.notNull).toBe(false);
    expect(questions.safetyFingerprintHash.notNull).toBe(false);
    expect(questions.safetyMetadataRetainUntil.notNull).toBe(false);
    expect(checks).toEqual(
      expect.arrayContaining([
        "questions_source_generation_batch_check",
        "questions_source_safety_metadata_check",
      ]),
    );
  });
});
