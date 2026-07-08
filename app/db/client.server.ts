import { Pool as NeonPool } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { drizzle as drizzleNodePostgres } from "drizzle-orm/node-postgres";
import type { PgDatabase } from "drizzle-orm/pg-core/db";
import type { PgQueryResultHKT } from "drizzle-orm/pg-core/session";
import { Pool as NodePostgresPool } from "pg";

import * as schema from "~/db/schema";
import { AppConfigurationError } from "~/lib/errors";
import { serverEnv, type ServerEnv } from "~/lib/env.server";

type RuntimeDatabasePool = NeonPool | NodePostgresPool;

export type RuntimeDatabase = PgDatabase<PgQueryResultHKT, typeof schema> & {
  $client: RuntimeDatabasePool;
};

let runtimeDatabase: RuntimeDatabase | undefined;

export function getRuntimeDatabaseUrl(
  environment: Pick<ServerEnv, "DATABASE_URL"> = serverEnv,
) {
  if (environment.DATABASE_URL === undefined) {
    throw new AppConfigurationError(
      "DATABASE_URL is required before opening the runtime database connection",
    );
  }

  return environment.DATABASE_URL;
}

export function getMigrationDatabaseUrl(
  environment: Pick<ServerEnv, "DATABASE_URL" | "DIRECT_DATABASE_URL"> = serverEnv,
) {
  return environment.DIRECT_DATABASE_URL ?? getRuntimeDatabaseUrl(environment);
}

export function createRuntimeDatabase(databaseUrl: string): RuntimeDatabase {
  if (isNeonDatabaseUrl(databaseUrl)) {
    return createNeonRuntimeDatabase(databaseUrl);
  }

  return createNodePostgresRuntimeDatabase(databaseUrl);
}

export function getRuntimeDatabase() {
  runtimeDatabase ??= createRuntimeDatabase(getRuntimeDatabaseUrl());
  return runtimeDatabase;
}

export function isNeonDatabaseUrl(databaseUrl: string) {
  const hostname = new URL(databaseUrl).hostname.toLowerCase();

  return hostname === "neon.tech" || hostname.endsWith(".neon.tech");
}

function createNeonRuntimeDatabase(databaseUrl: string): RuntimeDatabase {
  const pool = new NeonPool({ connectionString: databaseUrl });
  return drizzleNeon({ client: pool, schema });
}

function createNodePostgresRuntimeDatabase(databaseUrl: string): RuntimeDatabase {
  const pool = new NodePostgresPool({ connectionString: databaseUrl });
  return drizzleNodePostgres({ client: pool, schema });
}
