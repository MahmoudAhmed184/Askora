import type { ServerEnv } from "~/lib/env.server";

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
