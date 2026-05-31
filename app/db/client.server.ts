import { Pool } from "@neondatabase/serverless";
import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless";

import * as schema from "~/db/schema";
import { AppConfigurationError } from "~/lib/errors";
import { serverEnv, type ServerEnv } from "~/lib/env.server";

export type RuntimeDatabase = NeonDatabase<typeof schema> & {
  $client: Pool;
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
  const pool = new Pool({ connectionString: databaseUrl });
  return drizzle({ client: pool, schema });
}

export function getRuntimeDatabase() {
  runtimeDatabase ??= createRuntimeDatabase(getRuntimeDatabaseUrl());
  return runtimeDatabase;
}
