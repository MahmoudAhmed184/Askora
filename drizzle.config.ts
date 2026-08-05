import "dotenv/config";
import { defineConfig } from "drizzle-kit";
import { z } from "zod";

const emptyStringToUndefined = (value: unknown) =>
  value === "" ? undefined : value;

const optionalUrl = z.preprocess(
  emptyStringToUndefined,
  z.url().optional(),
);

const drizzleEnvSchema = z.object({
  DATABASE_URL: z.preprocess(emptyStringToUndefined, z.url()),
  DIRECT_DATABASE_URL: optionalUrl,
});

const drizzleEnv = drizzleEnvSchema.parse(process.env);

export default defineConfig({
  schema: "./app/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: drizzleEnv.DIRECT_DATABASE_URL ?? drizzleEnv.DATABASE_URL,
  },
  strict: true,
  verbose: true,
});
