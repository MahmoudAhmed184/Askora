import "dotenv/config";
import { defineConfig } from "drizzle-kit";

import { getMigrationDatabaseUrl } from "./app/db/client.server";
import { parseServerEnv } from "./app/lib/env.server";

const environment = parseServerEnv(process.env);

export default defineConfig({
  schema: "./app/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: getMigrationDatabaseUrl(environment),
  },
  strict: true,
  verbose: true,
});
