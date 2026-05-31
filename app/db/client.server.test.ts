import { describe, expect, it } from "vitest";

import {
  getMigrationDatabaseUrl,
  getRuntimeDatabaseUrl,
} from "~/db/client.server";

const pooledUrl =
  "postgres://user:password@ep-example-pooler.region.aws.neon.tech/neondb?sslmode=require";
const directUrl =
  "postgres://user:password@ep-example.region.aws.neon.tech/neondb?sslmode=require";

describe("database URL selection", () => {
  it("uses the pooled URL for runtime workloads", () => {
    expect(getRuntimeDatabaseUrl({ DATABASE_URL: pooledUrl })).toBe(pooledUrl);
  });

  it("uses the direct URL for migrations when present", () => {
    expect(
      getMigrationDatabaseUrl({
        DATABASE_URL: pooledUrl,
        DIRECT_DATABASE_URL: directUrl,
      }),
    ).toBe(directUrl);
  });

  it("falls back to the pooled URL for migrations in local setups", () => {
    expect(
      getMigrationDatabaseUrl({
        DATABASE_URL: pooledUrl,
      }),
    ).toBe(pooledUrl);
  });
});
