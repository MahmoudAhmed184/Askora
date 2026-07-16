import "dotenv/config";

import { pathToFileURL } from "node:url";

import pg from "pg";

const { Pool } = pg;

const adminRoleActions = ["promote", "demote"];

export function parseAdminRoleCommand(args, environment = process.env) {
  const [action, rawEmail, ...flags] = args;

  if (!adminRoleActions.includes(action)) {
    throw new Error(
      "Choose an admin role action through npm run admin:promote or npm run admin:demote.",
    );
  }

  const email = rawEmail?.trim();

  if (email === undefined || email.length === 0) {
    throw new Error(`Usage: npm run admin:${action} -- user@example.com --confirm=${action}`);
  }

  const allowedFlags = new Set([`--confirm=${action}`, "--allow-production"]);
  const unknownFlag = flags.find((flag) => !allowedFlags.has(flag));

  if (unknownFlag !== undefined) {
    throw new Error(`Unknown admin role flag: ${unknownFlag}`);
  }

  if (!flags.includes(`--confirm=${action}`)) {
    throw new Error(`Pass --confirm=${action} to confirm this role change.`);
  }

  const isProduction =
    environment.NODE_ENV === "production" ||
    environment.VERCEL_ENV === "production";

  if (isProduction && !flags.includes("--allow-production")) {
    throw new Error(
      "Refusing to change admin roles in production without --allow-production.",
    );
  }

  return {
    action,
    email,
    nextRole: action === "promote" ? "admin" : "user",
  };
}

export async function changeAdminRole({ action, email, pool }) {
  const client = await pool.connect();

  try {
    await client.query("begin");
    await client.query(
      "select pg_advisory_xact_lock(hashtext('qna-admin-role-management'))",
    );
    const currentResult = await client.query(
      `
        select id, email, role
        from users
        where lower(email) = lower($1)
        for update
      `,
      [email],
    );
    const currentUser = currentResult.rows[0];

    if (currentUser === undefined) {
      throw new Error(`No user found for ${email}.`);
    }

    const nextRole = action === "promote" ? "admin" : "user";

    if (currentUser.role === nextRole) {
      await client.query("commit");
      return {
        status: "unchanged",
        user: currentUser,
      };
    }

    if (action === "demote") {
      const adminCountResult = await client.query(
        "select count(*)::int as count from users where role = 'admin'",
      );
      const adminCount = Number(adminCountResult.rows[0]?.count ?? 0);

      if (adminCount <= 1) {
        throw new Error("Refusing to demote the last admin account.");
      }
    }

    const updateResult = await client.query(
      `
        update users
        set role = $2, updated_at = now()
        where id = $1
        returning id, email, role
      `,
      [currentUser.id, nextRole],
    );

    await client.query("commit");

    return {
      status: "changed",
      user: updateResult.rows[0],
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  const command = parseAdminRoleCommand(process.argv.slice(2));
  const databaseUrl =
    process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;

  if (databaseUrl === undefined || databaseUrl.length === 0) {
    throw new Error("DIRECT_DATABASE_URL or DATABASE_URL is required.");
  }

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    const result = await changeAdminRole({ ...command, pool });
    const verb = command.action === "promote" ? "Promoted" : "Demoted";
    const message =
      result.status === "changed"
        ? `${verb} ${result.user.email} (${result.user.id}) to ${result.user.role}.`
        : `${result.user.email} (${result.user.id}) is already ${result.user.role}.`;

    console.log(message);
  } finally {
    await pool.end();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
