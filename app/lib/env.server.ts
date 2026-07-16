import { z } from "zod";

const emptyStringToUndefined = (value: unknown) =>
  value === "" ? undefined : value;

const optionalString = z.preprocess(
  emptyStringToUndefined,
  z.string().min(1).optional(),
);

const optionalUrl = z.preprocess(
  emptyStringToUndefined,
  z.url().optional(),
);

const optionalSecret = z.preprocess(
  emptyStringToUndefined,
  z.string().min(32).optional(),
);

const booleanFromEnvironment = z.preprocess((value) => {
  if (value === undefined || value === "") {
    return undefined;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (["1", "true", "yes", "on"].includes(normalized)) {
      return true;
    }

    if (["0", "false", "no", "off"].includes(normalized)) {
      return false;
    }
  }

  return value;
}, z.boolean().default(true));

const trustedOriginsFromEnvironment = z.preprocess((value) => {
  if (value === undefined || value === "") {
    return [];
  }

  if (Array.isArray(value)) {
    return value.filter((origin): origin is string => typeof origin === "string");
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);
  }

  return value;
}, z.array(z.url()));

const trustedProxyIpHeader = z.enum([
  "x-vercel-forwarded-for",
  "cf-connecting-ip",
  "fly-client-ip",
  "x-real-ip",
  "x-client-ip",
]);

const baseServerEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  APP_NAME: z.string().min(1).default("qna-platform"),
  APP_URL: z.url().default("http://localhost:5173"),
  PUBLIC_BETA_NOINDEX: booleanFromEnvironment,
  DATABASE_URL: optionalUrl,
  DIRECT_DATABASE_URL: optionalUrl,
  TRUSTED_PROXY_IP_HEADER: trustedProxyIpHeader.default("x-vercel-forwarded-for"),
  TRUSTED_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(1),
  BETTER_AUTH_URL: optionalUrl,
  BETTER_AUTH_SECRET: optionalSecret,
  TRUSTED_ORIGINS: trustedOriginsFromEnvironment,
  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,
  RESEND_API_KEY: optionalString,
  AUTH_EMAIL_FROM: optionalString,
});

export const serverEnvSchema = baseServerEnvSchema
  .superRefine((environment, context) => {
    if (environment.NODE_ENV !== "production") {
      return;
    }

    requireProductionValue(context, environment.DATABASE_URL, "DATABASE_URL");
    requireProductionValue(
      context,
      environment.BETTER_AUTH_SECRET,
      "BETTER_AUTH_SECRET",
    );
    requireProductionValue(
      context,
      environment.GOOGLE_CLIENT_ID,
      "GOOGLE_CLIENT_ID",
    );
    requireProductionValue(
      context,
      environment.GOOGLE_CLIENT_SECRET,
      "GOOGLE_CLIENT_SECRET",
    );
    requireProductionValue(context, environment.RESEND_API_KEY, "RESEND_API_KEY");
    requireProductionValue(context, environment.AUTH_EMAIL_FROM, "AUTH_EMAIL_FROM");
  })
  .transform((environment) => {
    const betterAuthUrl = environment.BETTER_AUTH_URL ?? environment.APP_URL;
    const trustedOrigins = uniqueValues([
      environment.APP_URL,
      betterAuthUrl,
      ...environment.TRUSTED_ORIGINS,
    ]);

    return {
      ...environment,
      BETTER_AUTH_URL: betterAuthUrl,
      TRUSTED_ORIGINS: trustedOrigins,
    };
  });

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseServerEnv(environment: NodeJS.ProcessEnv): ServerEnv {
  return serverEnvSchema.parse(environment);
}

export const serverEnv = parseServerEnv(process.env);

function requireProductionValue(
  context: z.RefinementCtx,
  value: string | undefined,
  path: keyof z.input<typeof baseServerEnvSchema>,
) {
  if (value === undefined) {
    context.addIssue({
      code: "custom",
      message: `${path} is required in production`,
      path: [path],
    });
  }
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values));
}
