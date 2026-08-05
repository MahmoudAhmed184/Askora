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

const optionalQuestionGenerationEncryptionKeys = z.preprocess(
  emptyStringToUndefined,
  z
    .string()
    .min(1)
    .transform((value, context) => parseQuestionGenerationEncryptionKeys(value, context))
    .optional(),
);

const optionalQuestionGenerationEncryptionKeyVersion = z.preprocess(
  emptyStringToUndefined,
  z.coerce.number().int().positive().optional(),
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
  APP_NAME: z.string().min(1).default("Askora"),
  APP_URL: z.url().default("http://localhost:5173"),
  PUBLIC_BETA_NOINDEX: booleanFromEnvironment,
  VITE_SUPABASE_URL: optionalUrl,
  VITE_SUPABASE_PUBLISHABLE_KEY: optionalString,
  DATABASE_URL: optionalUrl,
  DIRECT_DATABASE_URL: optionalUrl,
  CRON_SECRET: optionalSecret,
  TRUSTED_PROXY_IP_HEADER: trustedProxyIpHeader.default("x-vercel-forwarded-for"),
  TRUSTED_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(1),
  BETTER_AUTH_URL: optionalUrl,
  BETTER_AUTH_SECRET: optionalSecret,
  TRUSTED_ORIGINS: trustedOriginsFromEnvironment,
  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,
  RESEND_API_KEY: optionalString,
  AUTH_EMAIL_FROM: optionalString,
  QUESTION_GENERATION_ENCRYPTION_KEYS: optionalQuestionGenerationEncryptionKeys,
  QUESTION_GENERATION_ACTIVE_ENCRYPTION_KEY_VERSION:
    optionalQuestionGenerationEncryptionKeyVersion,
});

export const serverEnvSchema = baseServerEnvSchema
  .superRefine((environment, context) => {
    validateQuestionGenerationEncryptionConfiguration(environment, context);

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
    requireProductionValue(context, environment.CRON_SECRET, "CRON_SECRET");
    requireProductionQuestionGenerationEncryptionConfiguration(
      context,
      environment,
    );
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

function parseQuestionGenerationEncryptionKeys(
  value: string,
  context: z.RefinementCtx,
) {
  const parsed = parseQuestionGenerationEncryptionKeyJson(value, context);

  if (parsed === undefined) {
    return z.NEVER;
  }

  const keys = new Map<number, Buffer>();

  for (const [version, encodedKey] of Object.entries(parsed)) {
    const numericVersion = Number(version);
    const key = decodeQuestionGenerationEncryptionKey(encodedKey);

    if (!Number.isSafeInteger(numericVersion) || numericVersion <= 0 || key === undefined) {
      context.addIssue({
        code: "custom",
        message:
          "QUESTION_GENERATION_ENCRYPTION_KEYS must map positive numeric versions to base64-encoded 32-byte keys",
      });
      return z.NEVER;
    }

    keys.set(numericVersion, key);
  }

  if (keys.size === 0) {
    context.addIssue({
      code: "custom",
      message: "QUESTION_GENERATION_ENCRYPTION_KEYS must contain at least one key",
    });
    return z.NEVER;
  }

  return keys;
}

function parseQuestionGenerationEncryptionKeyJson(
  value: string,
  context: z.RefinementCtx,
) {
  try {
    const parsed: unknown = JSON.parse(value);

    if (
      parsed === null ||
      Array.isArray(parsed) ||
      typeof parsed !== "object" ||
      Object.values(parsed).some((key) => typeof key !== "string")
    ) {
      throw new Error("Invalid keyring shape");
    }

    return parsed as Record<string, string>;
  } catch {
    context.addIssue({
      code: "custom",
      message:
        "QUESTION_GENERATION_ENCRYPTION_KEYS must be a JSON object mapping versions to keys",
    });
    return undefined;
  }
}

function decodeQuestionGenerationEncryptionKey(value: string) {
  if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(value)) {
    return undefined;
  }

  const key = Buffer.from(value, "base64");

  if (key.length !== 32) {
    return undefined;
  }

  const canonicalValues = [key.toString("base64"), key.toString("base64url")];

  return canonicalValues.includes(value) ? key : undefined;
}

function validateQuestionGenerationEncryptionConfiguration(
  environment: {
    QUESTION_GENERATION_ACTIVE_ENCRYPTION_KEY_VERSION?: number | undefined;
    QUESTION_GENERATION_ENCRYPTION_KEYS?:
      | ReadonlyMap<number, Buffer>
      | undefined;
  },
  context: z.RefinementCtx,
) {
  const keyring = environment.QUESTION_GENERATION_ENCRYPTION_KEYS;
  const activeVersion = environment.QUESTION_GENERATION_ACTIVE_ENCRYPTION_KEY_VERSION;

  if (keyring === undefined && activeVersion === undefined) {
    return;
  }

  if (keyring === undefined) {
    context.addIssue({
      code: "custom",
      message:
        "QUESTION_GENERATION_ENCRYPTION_KEYS is required when an active encryption key version is configured",
      path: ["QUESTION_GENERATION_ENCRYPTION_KEYS"],
    });
    return;
  }

  if (activeVersion === undefined) {
    context.addIssue({
      code: "custom",
      message:
        "QUESTION_GENERATION_ACTIVE_ENCRYPTION_KEY_VERSION is required when encryption keys are configured",
      path: ["QUESTION_GENERATION_ACTIVE_ENCRYPTION_KEY_VERSION"],
    });
    return;
  }

  if (!keyring.has(activeVersion)) {
    context.addIssue({
      code: "custom",
      message:
        "QUESTION_GENERATION_ACTIVE_ENCRYPTION_KEY_VERSION must exist in QUESTION_GENERATION_ENCRYPTION_KEYS",
      path: ["QUESTION_GENERATION_ACTIVE_ENCRYPTION_KEY_VERSION"],
    });
  }
}

function requireProductionQuestionGenerationEncryptionConfiguration(
  context: z.RefinementCtx,
  environment: {
    QUESTION_GENERATION_ACTIVE_ENCRYPTION_KEY_VERSION?: number | undefined;
    QUESTION_GENERATION_ENCRYPTION_KEYS?:
      | ReadonlyMap<number, Buffer>
      | undefined;
  },
) {
  if (environment.QUESTION_GENERATION_ENCRYPTION_KEYS === undefined) {
    context.addIssue({
      code: "custom",
      message: "QUESTION_GENERATION_ENCRYPTION_KEYS is required in production",
      path: ["QUESTION_GENERATION_ENCRYPTION_KEYS"],
    });
  }

  if (
    environment.QUESTION_GENERATION_ACTIVE_ENCRYPTION_KEY_VERSION === undefined
  ) {
    context.addIssue({
      code: "custom",
      message:
        "QUESTION_GENERATION_ACTIVE_ENCRYPTION_KEY_VERSION is required in production",
      path: ["QUESTION_GENERATION_ACTIVE_ENCRYPTION_KEY_VERSION"],
    });
  }
}
