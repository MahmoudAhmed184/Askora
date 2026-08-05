import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
  questionGenerationBatches,
  questionGenerationSettings,
} from "~/db/schema/question-generation";

describe("question generation schema", () => {
  it("stores one encrypted credential configuration for each owner", () => {
    const settings = getTableConfig(questionGenerationSettings);

    expect(questionGenerationSettings.ownerUserId.primary).toBe(true);
    expect(settings.checks.map((check) => check.name)).toContain(
      "question_generation_settings_credential_material_check",
    );
  });

  it("constrains generation batches to the supported request contract", () => {
    const batches = getTableConfig(questionGenerationBatches);

    expect(batches.checks.map((check) => check.name)).toEqual(
      expect.arrayContaining([
        "question_generation_batches_requested_count_check",
        "question_generation_batches_model_used_check",
        "question_generation_batches_token_counts_check",
      ]),
    );
  });
});
