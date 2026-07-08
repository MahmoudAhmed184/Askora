import "dotenv/config";
import { createHmac, randomBytes } from "node:crypto";
import pg from "pg";

const { Pool } = pg;

const DEVELOPMENT_AUTH_SECRET =
  "development-only-better-auth-secret-change-before-production";

function getServerAuthSecret() {
  return process.env.BETTER_AUTH_SECRET ?? DEVELOPMENT_AUTH_SECRET;
}

function getInviteCodeHash(inviteCode) {
  return createHmac("sha256", getServerAuthSecret())
    .update("invite-code")
    .update("\0")
    .update(inviteCode)
    .digest("hex");
}

// Generate a random code: QNA-XXXX-XXXX where X is uppercase alphanumeric
function generateInviteCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let part1 = "";
  let part2 = "";
  for (let i = 0; i < 4; i++) {
    part1 += chars[randomBytes(1)[0] % chars.length];
    part2 += chars[randomBytes(1)[0] % chars.length];
  }
  return `QNA-${part1}-${part2}`;
}

const databaseUrl = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;

if (databaseUrl === undefined || databaseUrl.length === 0) {
  console.error("DIRECT_DATABASE_URL or DATABASE_URL is required.");
  process.exit(1);
}

const pool = new Pool({ connectionString: databaseUrl });

async function main() {
  const code = generateInviteCode();
  const hash = getInviteCodeHash(code);
  const id = `cli_${randomBytes(6).toString("hex")}`;

  try {
    await pool.query(
      `
        insert into invite_codes (id, code_hash, created_at)
        values ($1, $2, now())
      `,
      [id, hash]
    );

    console.log("\n========================================");
    console.log("SUCCESS: Created a new active invite code!");
    console.log("Invite Code:", code);
    console.log("========================================\n");
  } catch (error) {
    console.error("Failed to generate or save invite code:", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
