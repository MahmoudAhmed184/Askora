import { AlertCircle, ChevronDown, KeyRound, MailCheck } from "lucide-react";
import { Form, Link } from "react-router";

import { PendingButton } from "~/components/shared/pending-button/pending-button";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "~/components/ui/alert/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card/card";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "~/components/ui/field/field";
import { Input } from "~/components/ui/input/input";
import { Separator } from "~/components/ui/separator/separator";
import type { AuthProviderStatus } from "~/lib/config.types";

export interface LoginActionData {
  login:
    | {
        status: "magic_link_sent";
        message: string;
      }
    | {
        status:
          | "auth_error"
          | "invalid_email"
          | "invalid_invite"
          | "provider_disabled"
          | "rate_limited";
        message: string;
        retryAfterSeconds?: number;
      };
}

interface LoginPanelProps {
  auth: AuthProviderStatus;
  result?: LoginActionData["login"] | undefined;
}

export function LoginPanel({ auth, result }: LoginPanelProps) {
  const googleReady = auth.databaseConfigured && auth.googleConfigured;
  const emailReady = auth.databaseConfigured && auth.emailMagicLinkConfigured;
  const hasInviteError = result?.status === "invalid_invite";

  return (
    <Card className="hover:translate-y-0 hover:border-border hover:shadow-[var(--shadow-card)]">
      <CardHeader className="gap-2 p-6 sm:p-7">
        <CardTitle className="font-serif text-2xl font-extrabold leading-tight">
          Sign in to Askora
        </CardTitle>
        <CardDescription>
          Existing accounts sign in directly. New accounts need an unused
          invite code.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6 pt-0 sm:p-7 sm:pt-0">
        <LoginResultAlert result={result} />

        <Form method="post">
          <div className="flex flex-col gap-5">
            <PendingButton
              className="h-11 w-full"
              disabled={!googleReady}
              name="intent"
              pendingText="Connecting to Google…"
              type="submit"
              value="google"
            >
              Continue with Google
            </PendingButton>

            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                or
              </span>
              <Separator className="flex-1" />
            </div>

            <Field data-disabled={!emailReady ? true : undefined}>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                aria-describedby="email-description"
                autoComplete="email"
                disabled={!emailReady}
                id="email"
                inputMode="email"
                name="email"
                placeholder="you@example.com"
                type="email"
              />
              <PendingButton
                className="w-full"
                disabled={!emailReady}
                name="intent"
                pendingText="Sending link…"
                type="submit"
                value="magic-link"
                variant="secondary"
              >
                Email me a magic link
              </PendingButton>
              <FieldDescription id="email-description">
                No password — we&apos;ll send a one-time sign-in link.
              </FieldDescription>
            </Field>

            <details
              className="group rounded-2xl border bg-surface px-4 py-3"
              open={hasInviteError || undefined}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-foreground outline-none [&::-webkit-details-marker]:hidden">
                <span className="flex items-center gap-2">
                  <KeyRound
                    aria-hidden="true"
                    className="size-4 text-primary"
                  />
                  New here? Add your invite code
                </span>
                <ChevronDown
                  aria-hidden="true"
                  className="size-4 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none"
                />
              </summary>
              <Field className="mt-3">
                <FieldLabel className="sr-only" htmlFor="inviteCode">
                  Invite code
                </FieldLabel>
                <Input
                  aria-describedby="invite-description"
                  aria-invalid={hasInviteError || undefined}
                  autoComplete="one-time-code"
                  className="uppercase placeholder:normal-case"
                  id="inviteCode"
                  name="inviteCode"
                  placeholder="BETA-ACCESS-2026"
                />
                <FieldDescription id="invite-description">
                  Required once to create an account. Existing accounts can
                  leave this closed.
                </FieldDescription>
              </Field>
            </details>
          </div>
        </Form>

        <AuthConfigurationStatus auth={auth} />
      </CardContent>
      <CardFooter className="p-6 pt-0 sm:p-7 sm:pt-0">
        <p className="text-xs leading-5 text-muted-foreground">
          By continuing, you agree to the{" "}
          <Link
            className="font-semibold text-foreground underline underline-offset-4 hover:text-primary"
            to="/terms"
          >
            Terms
          </Link>{" "}
          and acknowledge the{" "}
          <Link
            className="font-semibold text-foreground underline underline-offset-4 hover:text-primary"
            to="/privacy"
          >
            Privacy policy
          </Link>
          .
        </p>
      </CardFooter>
    </Card>
  );
}

function LoginResultAlert({
  result,
}: {
  result: LoginActionData["login"] | undefined;
}) {
  if (result === undefined) {
    return null;
  }

  if (result.status === "magic_link_sent") {
    return (
      <Alert className="mb-5" variant="success">
        <MailCheck aria-hidden="true" />
        <AlertTitle>Check your email</AlertTitle>
        <AlertDescription>{result.message}</AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert className="mb-5" variant="destructive">
      <AlertCircle aria-hidden="true" />
      <AlertTitle>Could not sign you in</AlertTitle>
      <AlertDescription>{result.message}</AlertDescription>
    </Alert>
  );
}

function AuthConfigurationStatus({ auth }: { auth: AuthProviderStatus }) {
  const missing = [
    auth.databaseConfigured ? undefined : "database",
    auth.googleConfigured ? undefined : "Google sign-in",
    auth.emailMagicLinkConfigured ? undefined : "email magic links",
  ].filter((entry): entry is string => entry !== undefined);

  if (missing.length === 0) {
    return null;
  }

  return (
    <Alert className="mt-5" variant="warning">
      <AlertCircle aria-hidden="true" />
      <AlertDescription>
        Not configured in this environment: {missing.join(", ")}.
      </AlertDescription>
    </Alert>
  );
}
