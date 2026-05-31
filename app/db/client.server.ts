import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";

import * as schema from "~/db/schema";
import { AppConfigurationError } from "~/lib/errors";
import { serverEnv, type ServerEnv } from "~/lib/env.server";

export type RuntimeDatabase = NeonHttpDatabase<typeof schema>;

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
  const sql = neon(databaseUrl);
  return drizzle({ client: sql, schema });
}

export function getRuntimeDatabase() {
  runtimeDatabase ??= createRuntimeDatabase(getRuntimeDatabaseUrl());
  return runtimeDatabase;
}
