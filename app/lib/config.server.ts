import { serverEnv, type ServerEnv } from "~/lib/env.server";

export interface PublicAppConfig {
  appName: string;
  appUrl: string;
  betaNoindex: boolean;
  environment: ServerEnv["NODE_ENV"];
}

export interface AuthProviderStatus {
  databaseConfigured: boolean;
  googleConfigured: boolean;
  emailMagicLinkConfigured: boolean;
}

export function getPublicAppConfig(
  environment: ServerEnv = serverEnv,
): PublicAppConfig {
  return {
    appName: environment.APP_NAME,
    appUrl: environment.APP_URL,
    betaNoindex: environment.PUBLIC_BETA_NOINDEX,
    environment: environment.NODE_ENV,
  };
}

export function getAuthProviderStatus(
  environment: ServerEnv = serverEnv,
): AuthProviderStatus {
  return {
    databaseConfigured: environment.DATABASE_URL !== undefined,
    googleConfigured:
      environment.GOOGLE_CLIENT_ID !== undefined &&
      environment.GOOGLE_CLIENT_SECRET !== undefined,
    emailMagicLinkConfigured:
      environment.RESEND_API_KEY !== undefined &&
      environment.AUTH_EMAIL_FROM !== undefined,
  };
}
