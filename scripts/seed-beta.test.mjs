import { describe, expect, it } from "vitest";

import {
  assertBetaSeedAllowed,
  betaFixture,
  createBetaSessionCookie,
  createSignedBetterAuthSessionCookie,
  getBetaResetStatements,
  seedBetaFixtures,
} from "./seed-beta.mjs";

const now = new Date("2026-05-31T12:00:00.000Z");

describe("assertBetaSeedAllowed", () => {
  it("requires explicit seed flags and a database URL", () => {
    expect(() => assertBetaSeedAllowed({})).toThrow(
      "DIRECT_DATABASE_URL or DATABASE_URL is required.",
    );
    expect(() =>
      assertBetaSeedAllowed({ DATABASE_URL: "postgres://example" }),
    ).toThrow("Set BETA_SEED_CONFIRM=reset-beta-fixtures");
    expect(() =>
      assertBetaSeedAllowed({
        DATABASE_URL: "postgres://example",
        BETA_SEED_CONFIRM: "reset-beta-fixtures",
      }),
    ).toThrow("Set BETA_SEED_SCOPE to local, preview, or test.");
  });

  it("refuses production even when seed flags are present", () => {
    expect(() =>
      assertBetaSeedAllowed({
        DATABASE_URL: "postgres://example",
        NODE_ENV: "production",
        BETA_SEED_CONFIRM: "reset-beta-fixtures",
        BETA_SEED_SCOPE: "preview",
      }),
    ).toThrow("Refusing to seed beta fixtures in production.");
  });

  it("accepts local and preview seed scopes", () => {
    expect(
      assertBetaSeedAllowed({
        DIRECT_DATABASE_URL: "postgres://direct",
        BETA_SEED_CONFIRM: "reset-beta-fixtures",
        BETA_SEED_SCOPE: "local",
      }),
    ).toBe("postgres://direct");
  });
});

describe("seedBetaFixtures", () => {
  it("uses only beta-scoped reset statements", () => {
    expect(getBetaResetStatements()).not.toHaveLength(0);

    for (const statement of getBetaResetStatements()) {
      expect(statement).toContain("beta_");
      expect(statement.toLowerCase()).toMatch(/^delete from /);
    }
  });

  it("resets and inserts deterministic fixture rows in one transaction", async () => {
    const database = createRecordingPool();

    await expect(
      seedBetaFixtures({
        now,
        pool: database.pool,
        secret: "test-secret",
      }),
    ).resolves.toMatchObject({
      users: 5,
      questions: 3,
      reports: 1,
    });

    expect(database.queries[0]).toBe("begin");
    expect(database.queries).toContain("commit");
    expect(database.queries).not.toContain("rollback");
    expect(
      database.queries.some((query) =>
        query.includes("insert into users"),
      ),
    ).toBe(true);
    expect(
      database.queries.some((query) =>
        query.includes("insert into questions"),
      ),
    ).toBe(true);
  });
});

describe("Better Auth beta session cookies", () => {
  it("signs deterministic Better Auth session cookies", () => {
    expect(
      createSignedBetterAuthSessionCookie({
        secret: "test-secret",
        sessionToken: "beta_session_owner_token",
      }),
    ).toBe(
      "beta_session_owner_token.fT7USUGnM687ko0Fth16yk47CvkVpxgHVojOB74GC0U=",
    );
  });

  it("creates Playwright-compatible cookies for seeded users", () => {
    expect(
      createBetaSessionCookie({
        appUrl: "http://127.0.0.1:5173",
        expiresAt: now,
        secret: "test-secret",
        user: betaFixture.users.owner,
      }),
    ).toMatchObject({
      name: "better-auth.session_token",
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
      expires: 1780228800,
    });
  });
});

function createRecordingPool() {
  const queries = [];
  const client = {
    query(sql) {
      queries.push(normalizeSql(sql));
      return Promise.resolve({ rows: [], rowCount: 0 });
    },
    release() {},
  };

  return {
    queries,
    pool: {
      connect() {
        return Promise.resolve(client);
      },
    },
  };
}

function normalizeSql(sql) {
  return sql.replace(/\s+/g, " ").trim();
}
