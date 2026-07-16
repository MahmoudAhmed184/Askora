import { describe, expect, it } from "vitest";

import {
  changeAdminRole,
  parseAdminRoleCommand,
} from "./promote-admin.mjs";

describe("admin role command", () => {
  it("requires action-specific confirmation", () => {
    expect(() =>
      parseAdminRoleCommand(["promote", "person@example.com"]),
    ).toThrow("Pass --confirm=promote");
    expect(() =>
      parseAdminRoleCommand([
        "demote",
        "person@example.com",
        "--confirm=promote",
      ]),
    ).toThrow("Unknown admin role flag");
  });

  it("requires an additional override in production", () => {
    expect(() =>
      parseAdminRoleCommand(
        ["demote", "person@example.com", "--confirm=demote"],
        { NODE_ENV: "production" },
      ),
    ).toThrow("Refusing to change admin roles in production");

    expect(
      parseAdminRoleCommand(
        [
          "demote",
          "person@example.com",
          "--confirm=demote",
          "--allow-production",
        ],
        { VERCEL_ENV: "production" },
      ),
    ).toMatchObject({ action: "demote", nextRole: "user" });
  });

  it("refuses to demote the last admin under the role-management lock", async () => {
    const database = createDatabase({ adminCount: 1, role: "admin" });

    await expect(
      changeAdminRole({
        action: "demote",
        email: "admin@example.com",
        pool: database.pool,
      }),
    ).rejects.toThrow("Refusing to demote the last admin account");

    expect(database.queries).toContain("rollback");
    expect(database.queries.some((query) => query.includes("advisory_xact_lock"))).toBe(
      true,
    );
    expect(database.released).toBe(true);
  });
});

function createDatabase({ adminCount, role }) {
  const queries = [];
  let released = false;
  const client = {
    query(sql) {
      const normalized = sql.trim();
      queries.push(normalized);

      if (normalized.startsWith("select id, email, role")) {
        return Promise.resolve({
          rows: [
            {
              id: "user_admin",
              email: "admin@example.com",
              role,
            },
          ],
        });
      }

      if (normalized.startsWith("select count(*)")) {
        return Promise.resolve({ rows: [{ count: adminCount }] });
      }

      return Promise.resolve({ rows: [] });
    },
    release() {
      released = true;
    },
  };

  return {
    get released() {
      return released;
    },
    pool: {
      connect() {
        return Promise.resolve(client);
      },
    },
    queries,
  };
}
