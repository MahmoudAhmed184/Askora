import { ArrowLeft, Inbox, MessageCircle, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { data, Link, redirect, useActionData } from "react-router";

import type { Route } from "./+types/login.route";
import { PublicShell } from "~/components/layout/public-shell/public-shell";
import { Button } from "~/components/ui/button/button";
import { getAuthProviderStatus } from "~/lib/config.server";
import { getFormString, parseFormData } from "~/lib/zod-form";
import { auth, getCurrentSessionSummaryFromContext } from "~/features/auth/services/auth.service.server";
import {
  getPostAuthRedirectPath,
} from "~/features/auth/services/post-auth-redirect.service.server";
import {
  clearTemporaryInviteCookieHeader,
  validateInviteCodeForSignIn,
} from "~/features/auth/services/invite.service.server";
import { magicLinkRequestSchema } from "~/features/auth/validations/magic-link.validations";
import { checkMagicLinkRateLimit } from "~/features/auth/services/magic-link-rate-limit.server";
import { LoginPanel, type LoginActionData } from "~/features/auth/components/login-panel";

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

  return (
    <PublicShell showSessionEntry={false}>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <Button asChild className="w-fit" size="sm" variant="ghost">
          <Link to="/">
            <ArrowLeft data-icon="inline-start" />
            Back to home
          </Link>
        </Button>

        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(380px,1fr)] lg:items-start lg:gap-14">
          <section className="flex min-w-0 flex-col gap-6 lg:pt-10">
            <h1 className="max-w-md font-serif text-3xl font-extrabold leading-tight text-foreground sm:text-4xl">
              Your questions are waiting.
            </h1>
            <p className="max-w-md text-base leading-7 text-muted-foreground">
              Sign in to review your inbox, keep drafts moving, and publish the
              threads worth reading.
            </p>
            <ul className="hidden flex-col gap-4 sm:flex">
              <SignInReason icon={<Inbox aria-hidden="true" />}>
                New questions land in a private inbox only you can see.
              </SignInReason>
              <SignInReason icon={<MessageCircle aria-hidden="true" />}>
                Drafts stay private until you choose to publish.
              </SignInReason>
              <SignInReason icon={<ShieldCheck aria-hidden="true" />}>
                Blocking, filtering, and reporting are one tap away.
              </SignInReason>
            </ul>
          </section>

          <LoginPanel auth={loaderData.auth} result={actionData?.login} />
        </div>
      </div>
    </PublicShell>
  );
}

function SignInReason({
  children,
  icon,
}: {
  children: ReactNode;
  icon: ReactNode;
}) {
  return (
    <li className="flex items-start gap-3 text-sm leading-6 text-muted-foreground">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary [&_svg]:size-4">
        {icon}
      </span>
      <span className="pt-1">{children}</span>
    </li>
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
