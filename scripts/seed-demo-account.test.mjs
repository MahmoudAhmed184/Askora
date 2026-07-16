import { describe, expect, it } from "vitest";

import {
  assertDemoSeedAllowed,
  seedDemoAccount,
} from "./seed-demo-account.mjs";

const now = new Date("2026-05-31T12:00:00.000Z");

describe("assertDemoSeedAllowed", () => {
  it("requires explicit seed flags and refuses production", () => {
    expect(() => assertDemoSeedAllowed({})).toThrow(
      "DIRECT_DATABASE_URL or DATABASE_URL is required.",
    );
    expect(() =>
      assertDemoSeedAllowed({
        DATABASE_URL: "postgres://example",
        DEMO_SEED_CONFIRM: "seed-demo-account",
        DEMO_SEED_SCOPE: "local",
        NODE_ENV: "production",
      }),
    ).toThrow("Refusing to seed demo fixtures in production.");
  });
});

describe("seedDemoAccount", () => {
  it("bootstraps a local target account when no completed profile exists", async () => {
    const database = createRecordingPool();

    const result = await seedDemoAccount({
      appUrl: "http://localhost:5173",
      bootstrapTarget: true,
      now,
      pool: database.pool,
      secret: "test-secret",
      targetEmail: "local.target@example.test",
    });

    expect(result.targetAccount).toMatchObject({
      email: "local.target@example.test",
      name: "Local Demo Target",
    });
    expect(result.targetAccount.username).toMatch(/^seed_target_/);
    expect(database.calls[0].sql).toBe("begin");
    expect(database.calls.some(isTargetUserInsert)).toBe(true);
    expect(database.calls.some(isTargetProfileInsert)).toBe(true);
    expect(database.calls.some((call) => call.sql === "commit")).toBe(true);
  });

  it("keeps the explicit failure when target bootstrapping is disabled", async () => {
    const database = createRecordingPool();

    await expect(
      seedDemoAccount({
        bootstrapTarget: false,
        now,
        pool: database.pool,
        secret: "test-secret",
        targetEmail: "local.target@example.test",
      }),
    ).rejects.toThrow(
      "No active completed profile was found for local.target@example.test.",
    );

    expect(database.calls.some((call) => call.sql === "rollback")).toBe(true);
  });
});

function createRecordingPool({
  targetRows = [],
  userRows = [],
} = {}) {
  const calls = [];
  const client = {
    query(sql, values = []) {
      const normalizedSql = normalizeSql(sql);
      calls.push({ sql: normalizedSql, values });

      if (normalizedSql.includes("from users inner join profiles")) {
        return Promise.resolve({ rows: targetRows, rowCount: targetRows.length });
      }

      if (
        normalizedSql.includes("from users") &&
        normalizedSql.includes("where lower(email) = lower($1)")
      ) {
        return Promise.resolve({ rows: userRows, rowCount: userRows.length });
      }

      return Promise.resolve({ rows: [], rowCount: 0 });
    },
    release() {},
  };

  return {
    calls,
    pool: {
      connect() {
        return Promise.resolve(client);
      },
    },
  };
}

function isTargetUserInsert(call) {
  return (
    call.sql.includes("insert into users") &&
    call.values.includes("local.target@example.test")
  );
}

function isTargetProfileInsert(call) {
  return (
    call.sql.includes("insert into profiles") &&
    call.values.some((value) =>
      typeof value === "string" && value.startsWith("seed_target_profile_"),
    )
  );
}

function normalizeSql(sql) {
  return sql.replace(/\s+/g, " ").trim();
}
