import { Pool as NeonPool } from "@neondatabase/serverless";
import { Pool as NodePostgresPool } from "pg";
import { describe, expect, it } from "vitest";

import {
  createRuntimeDatabase,
  getMigrationDatabaseUrl,
  getRuntimeDatabaseUrl,
  isNeonDatabaseUrl,
} from "~/db/client.server";

const pooledUrl =
  "postgres://user:password@ep-example-pooler.region.aws.neon.tech/neondb?sslmode=require";
const directUrl =
  "postgres://user:password@ep-example.region.aws.neon.tech/neondb?sslmode=require";

describe("database URL selection", () => {
  it("uses the pooled URL for runtime workloads", () => {
    expect(getRuntimeDatabaseUrl({ DATABASE_URL: pooledUrl })).toBe(pooledUrl);
  });

  it("creates a transaction-capable Neon WebSocket database for runtime workloads", async () => {
    const database = createRuntimeDatabase(pooledUrl);

    expect(database.$client).toBeInstanceOf(NeonPool);
    expect(typeof database.transaction).toBe("function");

    await database.$client.end();
  });

  it("creates a standard Postgres database for local workloads", async () => {
    const database = createRuntimeDatabase(
      "postgres://askora:askora_local@localhost:5432/askora?sslmode=disable",
    );

    expect(database.$client).toBeInstanceOf(NodePostgresPool);
    expect(typeof database.transaction).toBe("function");

    await database.$client.end();
  });

  it("detects Neon URLs by hostname", () => {
    expect(isNeonDatabaseUrl(pooledUrl)).toBe(true);
    expect(
      isNeonDatabaseUrl(
        "postgres://askora:askora_local@localhost:5432/askora?sslmode=disable",
      ),
    ).toBe(false);
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
