import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { magicLink } from "better-auth/plugins/magic-link";

import { getRuntimeDatabase } from "~/db/client.server";
import * as databaseSchema from "~/db/schema";
import {
  completeInviteForCreatedUser,
  requireConsumedInviteForUserCreate,
} from "~/features/auth/invite.server";
import { getAuthProviderStatus } from "~/lib/config.server";
import { AppConfigurationError } from "~/lib/errors";
import { getServerAuthSecret } from "~/lib/crypto.server";
import { serverEnv } from "~/lib/env.server";

export type CurrentSessionSummary =
  | {
      status: "anonymous";
    }
  | {
      status: "authenticated";
      user: {
        id: string;
        email: string;
        name: string;
      };
      profileStatus: "not_loaded";
    };

const authProviderStatus = getAuthProviderStatus();
const googleProvider = getGoogleProvider();

export const auth = betterAuth({
  appName: serverEnv.APP_NAME,
  baseURL: serverEnv.BETTER_AUTH_URL,
  secret: getServerAuthSecret(),
  trustedOrigins: serverEnv.TRUSTED_ORIGINS,
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  advanced: {
    useSecureCookies: serverEnv.NODE_ENV === "production",
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    storage: authProviderStatus.databaseConfigured ? "database" : "memory",
  },
  ...(authProviderStatus.databaseConfigured
    ? {
        database: drizzleAdapter(getRuntimeDatabase(), {
          provider: "pg",
          schema: {
            user: databaseSchema.authUsers,
            session: databaseSchema.authSessions,
            account: databaseSchema.authAccounts,
            verification: databaseSchema.authVerifications,
            rateLimit: databaseSchema.authRateLimits,
          },
        }),
      }
    : {}),
  plugins: [
    magicLink({
      storeToken: "hashed",
      sendMagicLink,
    }),
  ],
  databaseHooks: {
    user: {
      create: {
        before: async (_user, context) =>
          requireConsumedInviteForUserCreate(context),
        after: async (user, context) =>
          completeInviteForCreatedUser({ id: user.id }, context),
      },
    },
  },
  ...(googleProvider === undefined
    ? {}
    : {
        socialProviders: {
          google: googleProvider,
        },
      }),
});

export async function getCurrentSessionSummary(
  request: Request,
): Promise<CurrentSessionSummary> {
  if (!authProviderStatus.databaseConfigured) {
    return { status: "anonymous" };
  }

  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (session === null) {
    return { status: "anonymous" };
  }

  return {
    status: "authenticated",
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
    },
    profileStatus: "not_loaded",
  };
}

function getGoogleProvider() {
  if (
    serverEnv.GOOGLE_CLIENT_ID === undefined ||
    serverEnv.GOOGLE_CLIENT_SECRET === undefined
  ) {
    return undefined;
  }

  return {
    clientId: serverEnv.GOOGLE_CLIENT_ID,
    clientSecret: serverEnv.GOOGLE_CLIENT_SECRET,
  };
}

async function sendMagicLink({
  email,
  url,
}: {
  email: string;
  url: string;
}) {
  const resendApiKey = serverEnv.RESEND_API_KEY;
  const authEmailFrom = serverEnv.AUTH_EMAIL_FROM;

  if (resendApiKey === undefined || authEmailFrom === undefined) {
    throw new AppConfigurationError(
      "RESEND_API_KEY and AUTH_EMAIL_FROM are required to send magic links",
    );
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: authEmailFrom,
      to: email,
      subject: "Your Q&A Platform sign-in link",
      text: createMagicLinkText(url),
      html: createMagicLinkHtml(url),
    }),
  });

  if (!response.ok) {
    throw new Error(`Resend magic link request failed with ${String(response.status)}`);
  }
}

function createMagicLinkText(url: string) {
  return [
    "Use this link to sign in to Q&A Platform:",
    "",
    url,
    "",
    "If you did not request this email, you can ignore it.",
  ].join("\n");
}

function createMagicLinkHtml(url: string) {
  return [
    "<p>Use this link to sign in to Q&amp;A Platform:</p>",
    `<p><a href="${escapeHtmlAttribute(url)}">Sign in to Q&amp;A Platform</a></p>`,
    "<p>If you did not request this email, you can ignore it.</p>",
  ].join("");
}

function escapeHtmlAttribute(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
