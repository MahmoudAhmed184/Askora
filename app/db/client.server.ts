import {
  drizzle,
  type NodePgDatabase,
} from "drizzle-orm/node-postgres";
import { Pool as NodePostgresPool } from "pg";

import * as schema from "~/db/schema";
import { AppConfigurationError } from "~/lib/errors";
import { serverEnv, type ServerEnv } from "~/lib/env.server";

export type RuntimeDatabase = NodePgDatabase<typeof schema> & {
  $client: NodePostgresPool;
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
  const pool = new NodePostgresPool({ connectionString: databaseUrl });
  return drizzle({ client: pool, schema });
}

export function getRuntimeDatabase() {
  runtimeDatabase ??= createRuntimeDatabase(getRuntimeDatabaseUrl());
  return runtimeDatabase;
}
