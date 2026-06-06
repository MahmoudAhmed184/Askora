import {
  ArrowRight,
  CheckCircle2,
  Inbox,
  MessageCircle,
  ShieldCheck,
} from "lucide-react";
import type { ReactNode } from "react";
import { data, Link, redirect, useActionData } from "react-router";

import type { Route } from "./+types/login.route";
import {
  ActionToast,
  type ActionToastTone,
} from "~/components/app/action-toast";
import { PublicShell } from "~/components/app/public-shell";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { getAuthProviderStatus } from "~/lib/config.server";
import { getFormString, parseFormData } from "~/lib/zod-form";
import { auth, getCurrentSessionSummaryFromContext } from "~/features/auth/auth.server";
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

export function loader({ context }: Route.LoaderArgs) {
  const session = getCurrentSessionSummaryFromContext(context);

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
  const loginToast = getLoginToast(actionData?.login);

  return (
    <PublicShell showSessionEntry={false}>
      <ActionToast
        message={loginToast?.message}
        tone={loginToast?.tone ?? "info"}
        trigger={loginToast?.trigger}
      />
      <div className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.78fr)] lg:items-center">
        <section className="relative min-w-0 overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-[var(--shadow-card)]">
          <div
            aria-hidden="true"
            className="h-36 bg-[linear-gradient(135deg,oklch(0.72_0.13_310),oklch(0.47_0.15_294))] sm:h-44"
          >
            <div className="size-full opacity-15 [background-image:linear-gradient(to_right,var(--primary)_1px,transparent_1px),linear-gradient(to_bottom,var(--primary)_1px,transparent_1px)] [background-size:22px_22px]" />
          </div>

          <div className="p-6 pt-0 sm:p-8 sm:pt-0">
            <div className="-mt-12 flex flex-wrap items-end justify-between gap-4">
              <div className="flex size-24 items-center justify-center rounded-full border-4 border-card bg-secondary font-serif text-3xl font-extrabold text-primary shadow-[0_8px_22px_oklch(0.17_0.035_292_/_0.16)]">
                QA
              </div>
              <div className="flex flex-wrap gap-2 pb-1">
                <Badge variant="secondary">Private beta</Badge>
                <Badge variant="outline">Invite gate</Badge>
              </div>
            </div>

            <h1 className="mt-7 max-w-2xl font-serif text-4xl font-extrabold leading-tight text-foreground sm:text-5xl">
              Enter the private side of the public profile.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-8 text-muted-foreground">
              Review incoming questions, draft answers, and publish only the
              threads you want readers to see.
            </p>

            <div className="mt-7 border-y border-dashed py-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="flex items-center gap-2 font-mono text-xs font-bold text-primary">
                  <Inbox data-icon="inline-start" />
                  Waiting in inbox
                </p>
                <Badge variant="secondary">3 private questions</Badge>
              </div>
              <p className="mt-4 max-w-xl font-serif text-2xl font-bold italic leading-9 text-primary">
                "Which answer should stay private until it is actually useful?"
              </p>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <AccessSignal
                icon={<ShieldCheck data-icon="inline-start" />}
                label="Invite"
                text="Beta codes create new accounts."
              />
              <AccessSignal
                icon={<MessageCircle data-icon="inline-start" />}
                label="Draft"
                text="Answers stay private first."
              />
              <AccessSignal
                icon={<CheckCircle2 data-icon="inline-start" />}
                label="Publish"
                text="Threads appear by choice."
              />
            </div>
          </div>
        </section>

        <div className="flex w-full flex-col gap-4">
          <LoginPanel auth={loaderData.auth} />
          <Button asChild className="w-fit px-6" variant="outline">
            <Link to="/">
              Back to landing
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        </div>
      </div>
    </PublicShell>
  );
}

function AccessSignal({
  icon,
  label,
  text,
}: {
  icon: ReactNode;
  label: string;
  text: string;
}) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 font-mono text-[0.68rem] font-bold text-primary">
        {icon}
        {label}
      </p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
    </div>
  );
}

function getLoginToast(
  result: LoginActionData["login"] | undefined,
):
  | {
      message: string;
      tone: ActionToastTone;
      trigger: unknown;
    }
  | undefined {
  if (result === undefined) {
    return undefined;
  }

  return {
    message: result.message,
    tone: result.status === "magic_link_sent" ? "success" : "error",
    trigger: result,
  };
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
