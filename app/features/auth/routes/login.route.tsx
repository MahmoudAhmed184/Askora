import { ShieldCheck } from "lucide-react";
import { data, redirect, useActionData } from "react-router";

import type { Route } from "./+types/login.route";
import { PublicShell } from "~/components/app/public-shell";
import { Badge } from "~/components/ui/badge";
import { getAuthProviderStatus } from "~/lib/config.server";
import { getFormString, parseFormData } from "~/lib/zod-form";
import {
  getPostAuthRedirectPath,
} from "~/features/auth/post-auth-redirect.server";
import {
  clearTemporaryInviteCookieHeader,
  validateInviteCodeForSignIn,
} from "~/features/auth/invite.server";
import { magicLinkRequestSchema } from "~/features/auth/magic-link.schema";
import { hashWithHmacSha256 } from "~/lib/crypto.server";
import { getRequestInfoHashes } from "~/lib/request-info.server";
import {
  checkRateLimit,
  type RateLimitDecision,
  type RateLimitOptions,
} from "~/lib/rate-limit.server";
import { LoginPanel, type LoginActionData } from "~/features/auth/components/login-panel";

const MAGIC_LINK_RATE_LIMIT_WINDOW_SECONDS = 60 * 15;
const MAGIC_LINK_EMAIL_RATE_LIMIT_MAX = 5;
const MAGIC_LINK_IP_RATE_LIMIT_MAX = 20;

type LoginIntent = "google" | "magic-link";

export async function loader({ request }: Route.LoaderArgs) {
  const { getCurrentSessionSummary } = await import(
    "~/features/auth/auth.server"
  );
  const session = await getCurrentSessionSummary(request);

  if (session.status === "authenticated") {
    return redirect(getPostAuthRedirectPath(session));
  }

  return {
    auth: getAuthProviderStatus(),
  };
}

export async function action({ request }: Route.ActionArgs) {
  const authStatus = getAuthProviderStatus();
  const formData = await request.formData();
  const intent = getLoginIntent(formData);

  if (intent === undefined) {
    return data<LoginActionData>(
      {
        login: {
          status: "auth_error",
          message: "Choose a sign-in method and try again.",
        },
      },
      { status: 400 },
    );
  }

  if (!authStatus.databaseConfigured) {
    return providerDisabledResponse(clearTemporaryInviteCookieHeader());
  }

  const inviteCookie = await getInviteCookieHeader(formData);

  if (inviteCookie.status === "invalid") {
    return data<LoginActionData>(
      {
        login: {
          status: "invalid_invite",
          message:
            "Enter a valid unused invite code, or leave it blank for an existing account.",
        },
      },
      {
        status: 400,
        headers: getHeadersWithInviteCookie(clearTemporaryInviteCookieHeader()),
      },
    );
  }

  if (intent === "google") {
    return startGoogleSignIn({
      authStatus,
      inviteCookieHeader: inviteCookie.cookieHeader,
      request,
    });
  }

  return sendMagicLinkSignIn({
    authStatus,
    formData,
    inviteCookieHeader: inviteCookie.cookieHeader,
    request,
  });
}

export function meta() {
  return [{ title: "Log in | qna-platform" }];
}

export default function LoginRoute({ loaderData }: Route.ComponentProps) {
  const actionData = useActionData<typeof action>();

  return (
    <PublicShell>
      <div className="mx-auto grid w-full max-w-4xl gap-8 py-4 lg:min-h-[calc(100svh-15rem)] lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <section className="flex flex-col gap-5">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">Private beta</Badge>
            <Badge variant="outline">Invite required</Badge>
          </div>
          <div className="flex flex-col gap-3">
            <h1 className="max-w-xl text-4xl font-semibold leading-tight sm:text-5xl">
              Claim your Q&A profile when your invite is ready.
            </h1>
            <p className="max-w-md text-base leading-7 text-muted-foreground">
              Sign in is intentionally limited while profiles, invites, and
              email delivery are wired into the next slice.
            </p>
          </div>
          <div className="flex items-start gap-3 border-l px-4 py-1 text-sm leading-6 text-muted-foreground">
            <ShieldCheck
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-foreground"
            />
            Anonymous questions are anonymous to recipients and viewers, not to
            the platform.
          </div>
        </section>

        <LoginPanel auth={loaderData.auth} result={actionData?.login} />
      </div>
    </PublicShell>
  );
}

function getLoginIntent(formData: FormData): LoginIntent | undefined {
  const intent = getFormString(formData, "intent");

  if (intent === "google" || intent === "magic-link") {
    return intent;
  }

  return undefined;
}

async function getInviteCookieHeader(formData: FormData) {
  const inviteCode = getFormString(formData, "inviteCode");

  if (inviteCode === undefined) {
    return {
      status: "empty" as const,
      cookieHeader: clearTemporaryInviteCookieHeader(),
    };
  }

  const validation = await validateInviteCodeForSignIn(inviteCode);

  if (validation.status === "invalid") {
    return {
      status: "invalid" as const,
    };
  }

  return {
    status: "valid" as const,
    cookieHeader: validation.cookieHeader,
  };
}

async function startGoogleSignIn({
  authStatus,
  inviteCookieHeader,
  request,
}: {
  authStatus: ReturnType<typeof getAuthProviderStatus>;
  inviteCookieHeader: string;
  request: Request;
}) {
  if (!authStatus.databaseConfigured || !authStatus.googleConfigured) {
    return providerDisabledResponse(inviteCookieHeader);
  }

  try {
    const { auth } = await import("~/features/auth/auth.server");
    const authResponse = await auth.api.signInSocial({
      body: {
        provider: "google",
        callbackURL: getPostAuthRedirectPath(),
        newUserCallbackURL: getPostAuthRedirectPath(),
        errorCallbackURL: "/login",
      },
      headers: request.headers,
      returnHeaders: true,
    });

    if (authResponse.response.url === undefined) {
      return genericAuthErrorResponse(inviteCookieHeader);
    }

    return redirect(authResponse.response.url, {
      headers: mergeHeaders(
        authResponse.headers,
        getHeadersWithInviteCookie(inviteCookieHeader),
      ),
    });
  } catch {
    return genericAuthErrorResponse(inviteCookieHeader);
  }
}

async function sendMagicLinkSignIn({
  authStatus,
  formData,
  inviteCookieHeader,
  request,
}: {
  authStatus: ReturnType<typeof getAuthProviderStatus>;
  formData: FormData;
  inviteCookieHeader: string;
  request: Request;
}) {
  if (!authStatus.databaseConfigured || !authStatus.emailMagicLinkConfigured) {
    return providerDisabledResponse(inviteCookieHeader);
  }

  const parsed = parseFormData(magicLinkRequestSchema, formData);

  if (!parsed.ok) {
    return data<LoginActionData>(
      {
        login: {
          status: "invalid_email",
          message: "Enter a valid email address.",
        },
      },
      {
        status: 400,
        headers: getHeadersWithInviteCookie(inviteCookieHeader),
      },
    );
  }

  const rateLimitDecision = await checkMagicLinkRateLimit({
    email: parsed.value.email,
    request,
  });

  if (!rateLimitDecision.allowed) {
    return data<LoginActionData>(
      {
        login: {
          status: "rate_limited",
          message: "Too many magic-link requests. Try again later.",
          retryAfterSeconds: rateLimitDecision.retryAfterSeconds,
        },
      },
      {
        status: 429,
        headers: getHeadersWithInviteCookie(inviteCookieHeader),
      },
    );
  }

  try {
    const { auth } = await import("~/features/auth/auth.server");
    const authResponse = await auth.api.signInMagicLink({
      body: {
        email: parsed.value.email,
        callbackURL: getPostAuthRedirectPath(),
        newUserCallbackURL: getPostAuthRedirectPath(),
        errorCallbackURL: "/login",
      },
      headers: request.headers,
      returnHeaders: true,
    });

    return data<LoginActionData>(
      {
        login: {
          status: "magic_link_sent",
          message:
            "If this email can sign in, a magic link has been sent. New accounts still require an unused invite.",
        },
      },
      {
        headers: mergeHeaders(
          authResponse.headers,
          getHeadersWithInviteCookie(inviteCookieHeader),
        ),
      },
    );
  } catch {
    return genericAuthErrorResponse(inviteCookieHeader);
  }
}

async function checkMagicLinkRateLimit({
  email,
  request,
  rateLimit = checkRateLimit,
}: {
  email: string;
  request: Request;
  rateLimit?: (options: RateLimitOptions) => Promise<RateLimitDecision>;
}) {
  const requestInfo = getRequestInfoHashes(request);
  const emailHash = hashWithHmacSha256(email, "magic-link-email");
  const emailDecision = await rateLimit({
    key: `magic-link:email:${emailHash}`,
    max: MAGIC_LINK_EMAIL_RATE_LIMIT_MAX,
    windowSeconds: MAGIC_LINK_RATE_LIMIT_WINDOW_SECONDS,
  });

  if (!emailDecision.allowed) {
    return emailDecision;
  }

  return rateLimit({
    key: `magic-link:ip:${requestInfo.ipHash}`,
    max: MAGIC_LINK_IP_RATE_LIMIT_MAX,
    windowSeconds: MAGIC_LINK_RATE_LIMIT_WINDOW_SECONDS,
  });
}

function providerDisabledResponse(inviteCookieHeader: string) {
  return data<LoginActionData>(
    {
      login: {
        status: "provider_disabled",
        message: "This sign-in method is not configured yet.",
      },
    },
    {
      status: 503,
      headers: getHeadersWithInviteCookie(inviteCookieHeader),
    },
  );
}

function genericAuthErrorResponse(inviteCookieHeader: string) {
  return data<LoginActionData>(
    {
      login: {
        status: "auth_error",
        message: "Sign-in could not be started. Try again later.",
      },
    },
    {
      status: 502,
      headers: getHeadersWithInviteCookie(inviteCookieHeader),
    },
  );
}

function getHeadersWithInviteCookie(inviteCookieHeader: string) {
  const headers = new Headers();
  headers.append("Set-Cookie", inviteCookieHeader);
  return headers;
}

function mergeHeaders(...headersToMerge: Headers[]) {
  const headers = new Headers();

  for (const nextHeaders of headersToMerge) {
    nextHeaders.forEach((value, key) => {
      headers.append(key, value);
    });
  }

  return headers;
}
