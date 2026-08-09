import "dotenv/config";

import { readFile, readdir } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

const { Pool } = pg;
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const migrationDirectory = resolve(repositoryRoot, "drizzle");
const databaseUrl = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;

if (databaseUrl === undefined || databaseUrl.trim().length === 0) {
  throw new Error("DIRECT_DATABASE_URL or DATABASE_URL is required.");
}

if (process.env.MIGRATION_REHEARSAL_CONFIRM !== "reset-schema") {
  throw new Error(
    "Set MIGRATION_REHEARSAL_CONFIRM=reset-schema before running the disposable migration rehearsal.",
  );
}

const migrationFiles = (await readdir(migrationDirectory))
  .filter((file) => /^\d{4}_.*\.sql$/u.test(file))
  .sort();

if (migrationFiles.length < 20) {
  throw new Error("Expected the complete migration history before rehearsing.");
}

const pool = new Pool({ connectionString: databaseUrl });
const client = await pool.connect();

try {
  await resetSchema(client);

  for (const migrationFile of migrationFiles.slice(0, 18)) {
    await applyMigration(client, migrationFile);
  }

  await seedPrePr2Question(client);
  await applyMigrationsInOneTransaction(client, migrationFiles.slice(18));

  const preserved = await client.query(
    `
      select source::text as source,
             pg_get_expr(defaults.adbin, defaults.adrelid) as source_default
      from questions
      cross join lateral (
        select pg_attrdef.adbin, pg_attrdef.adrelid
        from pg_attrdef
        where pg_attrdef.adrelid = 'public.questions'::regclass
          and pg_attrdef.adnum = (
            select attnum from pg_attribute
            where attrelid = 'public.questions'::regclass
              and attname = 'source'
          )
      ) defaults
      where id = 'migration_rehearsal_question'
    `,
  );
  const preservedRow = preserved.rows[0];

  if (
    preservedRow?.source !== "public_profile" ||
    !String(preservedRow.source_default).includes("public_profile")
  ) {
    throw new Error("0017 public_profile data/default was not preserved by 0018.");
  }

  const latest = await client.query(
    `select source::text as source from questions where id = 'migration_rehearsal_question'`,
  );

  if (latest.rows[0]?.source !== "public_profile") {
    throw new Error("The preserved public_profile row changed after latest migration.");
  }

  console.log("0017 -> latest migration rehearsal passed in one pending Drizzle migration transaction.");
} finally {
  // Leave the disposable database ready for the normal Drizzle migration and
  // subsequent integration/E2E jobs.
  await resetSchema(client);
  client.release();
  await pool.end();
}

async function applyMigration(client, migrationFile) {
  const source = await readFile(resolve(migrationDirectory, migrationFile), "utf8");
  const statements = source.split(/--> statement-breakpoint/gu);

  await client.query("begin");

  try {
    for (const statement of statements) {
      if (statement.trim().length > 0) {
        await client.query(statement);
      }
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw new Error(`Migration ${basename(migrationFile)} failed.`, { cause: error });
  }
}

async function applyMigrationsInOneTransaction(client, migrationFilesToApply) {
  await client.query("begin");

  try {
    for (const migrationFile of migrationFilesToApply) {
      const source = await readFile(resolve(migrationDirectory, migrationFile), "utf8");

      for (const statement of source.split(/--> statement-breakpoint/gu)) {
        if (statement.trim().length > 0) {
          await client.query(statement);
        }
      }
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw new Error("The 0017-to-latest pending migration transaction failed.", {
      cause: error,
    });
  }
}

async function seedPrePr2Question(client) {
  await client.query(
    `
      insert into users (id, name, email)
      values ('migration_rehearsal_user', 'Migration Rehearsal', 'migration-rehearsal@example.test')
    `,
  );
  await client.query(
    `
      insert into profiles (id, user_id, username, display_name)
      values ('migration_rehearsal_profile', 'migration_rehearsal_user', 'migration_rehearsal', 'Migration Rehearsal')
    `,
  );
  await client.query(
    `
      insert into questions (
        id, public_id, recipient_profile_id, recipient_user_id, identity_mode,
        original_text, normalized_text_hash, safety_fingerprint_hash,
        safety_metadata_retain_until
      )
      values (
        'migration_rehearsal_question', 'migration_rehearsal_question',
        'migration_rehearsal_profile', 'migration_rehearsal_user',
        'account_anonymous', 'A preserved question?', 'migration_hash',
        'migration_fingerprint', now()
      )
    `,
  );
}

async function resetSchema(client) {
  await client.query("drop schema if exists public cascade");
  await client.query("drop schema if exists drizzle cascade");
  await client.query("create schema public");
}
