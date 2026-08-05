import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("question-generation migration", () => {
  it("preserves source safety invariants and server-only table access", async () => {
    const migration = await readFile(resolve("drizzle/0018_premium_nekra.sql"), "utf8");

    expect(migration).toContain(
      'ALTER TYPE "public"."question_source" ADD VALUE \'ai_generated\'',
    );
    expect(migration).toContain(
      'CONSTRAINT "questions_source_generation_batch_check" CHECK',
    );
    expect(migration).toContain(
      'CONSTRAINT "questions_source_safety_metadata_check" CHECK',
    );
    expect(migration).toContain(
      "ALTER TABLE public.question_generation_batches ENABLE ROW LEVEL SECURITY",
    );
    expect(migration).toContain(
      "ALTER TABLE public.question_generation_settings ENABLE ROW LEVEL SECURITY",
    );
    expect(migration).toContain(
      "REVOKE ALL PRIVILEGES ON TABLE public.question_generation_batches FROM anon, authenticated",
    );
    expect(migration).toContain(
      "REVOKE ALL PRIVILEGES ON TABLE public.question_generation_settings FROM anon, authenticated",
    );
  });
});
