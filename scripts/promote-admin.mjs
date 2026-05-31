import "dotenv/config";

import { Pool } from "@neondatabase/serverless";

const email = process.argv[2]?.trim();
const databaseUrl = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;

if (!email) {
  console.error("Usage: npm run admin:promote -- user@example.com");
  process.exit(1);
}

if (databaseUrl === undefined || databaseUrl.length === 0) {
  console.error("DIRECT_DATABASE_URL or DATABASE_URL is required.");
  process.exit(1);
}

const pool = new Pool({ connectionString: databaseUrl });

try {
  const result = await pool.query(
    `
      update users
      set role = 'admin', updated_at = now()
      where lower(email) = lower($1)
      returning id, email, role
    `,
    [email],
  );

  if (result.rowCount === 0) {
    console.error(`No user found for ${email}.`);
    process.exitCode = 1;
  } else {
    const user = result.rows[0];
    console.log(`Promoted ${user.email} (${user.id}) to ${user.role}.`);
  }
} finally {
  await pool.end();
}
