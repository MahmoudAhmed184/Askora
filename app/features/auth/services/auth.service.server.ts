import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { magicLink } from "better-auth/plugins/magic-link";
import { eq } from "drizzle-orm";
import { redirect, type RouterContextProvider } from "react-router";

import { getRuntimeDatabase } from "~/db/client.server";
import * as databaseSchema from "~/db/schema";
import { authUsers, profiles } from "~/db/schema";
import { currentSessionContext } from "~/features/auth/auth.context";
import {
  completeInviteForCreatedUser,
  requireConsumedInviteForUserCreate,
} from "~/features/auth/services/invite.service.server";
import { getAuthProviderStatus } from "~/lib/config.server";
import { AppConfigurationError } from "~/lib/errors";
import { getServerAuthSecret } from "~/lib/crypto.server";
import { serverEnv } from "~/lib/env.server";

export type ActiveSuspensionStatus = "none" | "active";

export interface CurrentSessionUser {
  id: string;
  email: string;
  name: string;
  image: string | undefined;
}

export interface IncompleteProfileSessionSummary {
  status: "authenticated";
  user: CurrentSessionUser;
  profileStatus: "incomplete";
  suspensionStatus: ActiveSuspensionStatus;
}

export interface CompletedProfileSessionSummary {
  status: "authenticated";
  user: CurrentSessionUser;
  profileStatus: "complete";
  suspensionStatus: ActiveSuspensionStatus;
  /** False while the profile is deactivated but the account remains recoverable. */
  profileActive?: boolean;
  deletionPending?: boolean;
  profile: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

export type AuthenticatedSessionSummary =
  | IncompleteProfileSessionSummary
  | CompletedProfileSessionSummary;

export type CurrentSessionSummary =
  | {
      status: "anonymous";
    }
  | AuthenticatedSessionSummary;

export type CurrentSessionContextReader = Pick<RouterContextProvider, "get">;

export type PublicSessionSummary =
  | {
      status: "anonymous";
    }
  | {
      status: "authenticated";
      profileStatus: "incomplete";
      suspensionStatus: ActiveSuspensionStatus;
    }
  | {
      status: "authenticated";
      profileStatus: "complete";
      suspensionStatus: ActiveSuspensionStatus;
      profile: {
        username: string;
        displayName: string;
      };
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
    ipAddress: {
      ipAddressHeaders: [serverEnv.TRUSTED_PROXY_IP_HEADER],
    },
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

  const sessionUser = await getSessionUserSummary(session.user.id);

  if (sessionUser === undefined) {
    return { status: "anonymous" };
  }

  return sessionUser;
}

export async function getPublicSessionSummary(request: Request) {
  return toPublicSessionSummary(await getCurrentSessionSummary(request));
}

export function getCurrentSessionSummaryFromContext(
  context: CurrentSessionContextReader,
): CurrentSessionSummary {
  return context.get(currentSessionContext);
}

export function toPublicSessionSummary(
  session: CurrentSessionSummary,
): PublicSessionSummary {
  if (session.status === "anonymous") {
    return session;
  }

  if (session.profileStatus === "incomplete") {
    return {
      status: "authenticated",
      profileStatus: "incomplete",
      suspensionStatus: session.suspensionStatus,
    };
  }

  return {
    status: "authenticated",
    profileStatus: "complete",
    suspensionStatus: session.suspensionStatus,
    profile: {
      username: session.profile.username,
      displayName: session.profile.displayName,
    },
  };
}

export async function requireAuthenticatedSession(
  request: Request,
): Promise<AuthenticatedSessionSummary | Response> {
  const session = await getCurrentSessionSummary(request);
  const redirectPath = getAuthenticatedGuardRedirectPath(session);

  if (redirectPath !== undefined) {
    return redirect(redirectPath);
  }

  return session as AuthenticatedSessionSummary;
}

export function requireAuthenticatedSessionFromContext(
  context: CurrentSessionContextReader,
): AuthenticatedSessionSummary | Response {
  const session = getCurrentSessionSummaryFromContext(context);
  const redirectPath = getAuthenticatedGuardRedirectPath(session);

  if (redirectPath !== undefined) {
    return redirect(redirectPath);
  }

  return session as AuthenticatedSessionSummary;
}

export async function requireIncompleteProfileSession(
  request: Request,
): Promise<IncompleteProfileSessionSummary | Response> {
  const session = await getCurrentSessionSummary(request);
  const redirectPath = getIncompleteProfileGuardRedirectPath(session);

  if (redirectPath !== undefined) {
    return redirect(redirectPath);
  }

  return session as IncompleteProfileSessionSummary;
}

export function requireIncompleteProfileSessionFromContext(
  context: CurrentSessionContextReader,
): IncompleteProfileSessionSummary | Response {
  const session = getCurrentSessionSummaryFromContext(context);
  const redirectPath = getIncompleteProfileGuardRedirectPath(session);

  if (redirectPath !== undefined) {
    return redirect(redirectPath);
  }

  return session as IncompleteProfileSessionSummary;
}

export async function requireCompletedProfileSession(
  request: Request,
): Promise<CompletedProfileSessionSummary | Response> {
  const session = await getCurrentSessionSummary(request);
  const redirectPath = getCompletedProfileGuardRedirectPath(session);

  if (redirectPath !== undefined) {
    return redirect(redirectPath);
  }

  return session as CompletedProfileSessionSummary;
}

export function requireCompletedProfileSessionFromContext(
  context: CurrentSessionContextReader,
): CompletedProfileSessionSummary | Response {
  const session = getCurrentSessionSummaryFromContext(context);
  const redirectPath = getCompletedProfileGuardRedirectPath(session);

  if (redirectPath !== undefined) {
    return redirect(redirectPath);
  }

  return session as CompletedProfileSessionSummary;
}

/**
 * The account settings screen is the one authenticated surface that must stay
 * available while a profile is deactivated so the owner can reactivate it or
 * cancel a pending deletion. All other completed-profile routes use the
 * active-profile guard above.
 */
export function requireCompletedProfileSessionAllowingInactiveFromContext(
  context: CurrentSessionContextReader,
): CompletedProfileSessionSummary | Response {
  const session = getCurrentSessionSummaryFromContext(context);

  if (session.status === "anonymous") {
    return redirect("/login");
  }

  return session.profileStatus === "incomplete"
    ? redirect("/setup")
    : session;
}

export function getAuthenticatedGuardRedirectPath(
  session: CurrentSessionSummary,
) {
  return session.status === "anonymous" ? "/login" : undefined;
}

export function getIncompleteProfileGuardRedirectPath(
  session: CurrentSessionSummary,
) {
  if (session.status === "anonymous") {
    return "/login";
  }

  return session.profileStatus === "complete" ? "/feed" : undefined;
}

export function getCompletedProfileGuardRedirectPath(
  session: CurrentSessionSummary,
) {
  if (session.status === "anonymous") {
    return "/login";
  }

  if (session.profileStatus === "incomplete") {
    return "/setup";
  }

  return session.profileActive === false || isSessionSuspended(session)
    ? "/settings/account"
    : undefined;
}

export function isSessionSuspended(session: AuthenticatedSessionSummary) {
  return session.suspensionStatus === "active";
}

async function getSessionUserSummary(
  userId: string,
): Promise<AuthenticatedSessionSummary | undefined> {
  const [user] = await getRuntimeDatabase()
    .select({
      id: authUsers.id,
      email: authUsers.email,
      name: authUsers.name,
      image: authUsers.image,
      suspensionStatus: authUsers.suspensionStatus,
      suspendedUntil: authUsers.suspendedUntil,
      deletedAt: authUsers.deletedAt,
      deletionAnonymizedAt: authUsers.deletionAnonymizedAt,
      profileId: profiles.id,
      profileUsername: profiles.username,
      profileDisplayName: profiles.displayName,
      profileAvatarUrl: profiles.avatarUrl,
      profileIsActive: profiles.isActive,
    })
    .from(authUsers)
    .leftJoin(profiles, eq(profiles.userId, authUsers.id))
    .where(eq(authUsers.id, userId))
    .limit(1);

  if (user === undefined) {
    return undefined;
  }

  // Once anonymization has completed there is no recoverable account left.
  if (user.deletionAnonymizedAt !== null) {
    return undefined;
  }

  const baseSession = {
    status: "authenticated" as const,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image ?? undefined,
    },
    suspensionStatus: getActiveSuspensionStatus({
      status: user.suspensionStatus,
      suspendedUntil: user.suspendedUntil,
    }),
  };

  if (
    user.profileId === null ||
    user.profileUsername === null ||
    user.profileDisplayName === null
  ) {
    return {
      ...baseSession,
      profileStatus: "incomplete",
    };
  }

  return {
    ...baseSession,
    profileStatus: "complete",
    profile: {
      id: user.profileId,
      username: user.profileUsername,
      displayName: user.profileDisplayName,
      avatarUrl: user.profileAvatarUrl,
    },
    profileActive: user.deletedAt === null && (user.profileIsActive ?? false),
    deletionPending: user.deletedAt !== null,
  };
}

function getActiveSuspensionStatus({
  status,
  suspendedUntil,
}: {
  status: "warned" | "suspended" | "permanent" | null;
  suspendedUntil: Date | null;
}): ActiveSuspensionStatus {
  if (status === "permanent") {
    return "active";
  }

  if (status !== "suspended") {
    return "none";
  }

  return suspendedUntil === null || suspendedUntil.getTime() > Date.now()
    ? "active"
    : "none";
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
