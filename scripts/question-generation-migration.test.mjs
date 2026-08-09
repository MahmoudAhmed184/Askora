import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("question-generation migration", () => {
  it("keeps generation tables server-only and removes question provenance", async () => {
    const setupMigration = await readFile(
      resolve("drizzle/0018_premium_nekra.sql"),
      "utf8",
    );
    const cleanupMigration = await readFile(
      resolve("drizzle/0021_remove-question-generation-provenance.sql"),
      "utf8",
    );

    expect(setupMigration).toContain(
      "ALTER TABLE public.question_generation_batches ENABLE ROW LEVEL SECURITY",
    );
    expect(setupMigration).toContain(
      "ALTER TABLE public.question_generation_settings ENABLE ROW LEVEL SECURITY",
    );
    expect(setupMigration).toContain(
      "REVOKE ALL PRIVILEGES ON TABLE public.question_generation_batches FROM anon, authenticated",
    );
    expect(setupMigration).toContain(
      "REVOKE ALL PRIVILEGES ON TABLE public.question_generation_settings FROM anon, authenticated",
    );
    expect(cleanupMigration).toContain(
      'ALTER TABLE "questions" DROP COLUMN "source"',
    );
    expect(cleanupMigration).toContain(
      'ALTER TABLE "questions" DROP COLUMN "generation_batch_id"',
    );
    expect(cleanupMigration).toContain(
      'CONSTRAINT "questions_safety_metadata_pair_check" CHECK',
    );
    expect(cleanupMigration).toContain('DROP TYPE "public"."question_source"');
  });
});
