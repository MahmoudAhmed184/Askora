import { Pool as NodePostgresPool } from "pg";
import { describe, expect, it } from "vitest";

import {
  createRuntimeDatabase,
  getMigrationDatabaseUrl,
  getRuntimeDatabaseUrl,
} from "~/db/client.server";

const runtimeUrl =
  "postgresql://app_role.project_ref:password@aws-0-region.pooler.supabase.com:6543/postgres?sslmode=require";
const migrationUrl =
  "postgresql://app_role.project_ref:password@aws-0-region.pooler.supabase.com:5432/postgres?sslmode=require";

describe("database URL selection", () => {
  it("uses the pooled URL for runtime workloads", () => {
    expect(getRuntimeDatabaseUrl({ DATABASE_URL: runtimeUrl })).toBe(runtimeUrl);
  });

  it("creates a transaction-capable Postgres database for runtime workloads", async () => {
    const database = createRuntimeDatabase(runtimeUrl);

    expect(database.$client).toBeInstanceOf(NodePostgresPool);
    expect(typeof database.transaction).toBe("function");

    await database.$client.end();
  });

  it("uses the direct URL for migrations when present", () => {
    expect(
      getMigrationDatabaseUrl({
        DATABASE_URL: runtimeUrl,
        DIRECT_DATABASE_URL: migrationUrl,
      }),
    ).toBe(migrationUrl);
  });

  it("falls back to the pooled URL for migrations in local setups", () => {
    expect(
      getMigrationDatabaseUrl({
        DATABASE_URL: runtimeUrl,
      }),
    ).toBe(runtimeUrl);
  });
});
