import { ArrowRight, KeyRound, Mail } from "lucide-react";
import { Form } from "react-router";

import { PendingButton } from "~/components/app/pending-button";
import { Badge } from "~/components/ui/badge";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import type { AuthProviderStatus } from "~/lib/config.server";

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
  result: LoginActionData["login"] | undefined;
}

export function LoginPanel({ auth, result }: LoginPanelProps) {
  const googleReady = auth.databaseConfigured && auth.googleConfigured;
  const emailReady = auth.databaseConfigured && auth.emailMagicLinkConfigured;

  return (
    <section aria-labelledby="login-heading" className="border-y py-6">
      <header className="flex flex-col gap-1.5">
        <h2 className="text-2xl font-semibold leading-none" id="login-heading">
          Log in
        </h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Google is primary. Email magic links are available when email delivery
          is configured.
        </p>
      </header>

      <Form className="mt-6" method="post">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="inviteCode">
              Invite code <span className="text-muted-foreground">(required for new accounts)</span>
            </FieldLabel>
            <div className="relative">
              <KeyRound
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                autoComplete="one-time-code"
                className="pl-9 uppercase"
                id="inviteCode"
                name="inviteCode"
                placeholder="BETA-ACCESS-2026"
              />
            </div>
            <FieldDescription>
              Existing accounts can sign in without a new invite.
            </FieldDescription>
          </Field>

          <PendingButton
            disabled={!googleReady}
            name="intent"
            pendingText="Connecting"
            type="submit"
            value="google"
          >
            Continue with Google
            <ArrowRight data-icon="inline-end" />
          </PendingButton>

          <Field data-disabled={!emailReady ? true : undefined}>
            <FieldLabel htmlFor="email">Email magic link</FieldLabel>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                disabled={!emailReady}
                id="email"
                inputMode="email"
                name="email"
                placeholder="you@example.com"
                type="email"
              />
              <PendingButton
                className="sm:w-40"
                disabled={!emailReady}
                name="intent"
                pendingText="Sending"
                type="submit"
                value="magic-link"
                variant="secondary"
              >
                <Mail data-icon="inline-start" />
                Send link
              </PendingButton>
            </div>
            <FieldDescription>
              Magic links use the same invite gate when a new account is created.
            </FieldDescription>
          </Field>

          <LoginMessage result={result} />
        </FieldGroup>
      </Form>

      <AuthConfigurationStatus auth={auth} />
    </section>
  );
}

function LoginMessage({
  result,
}: {
  result: LoginActionData["login"] | undefined;
}) {
  if (result === undefined) {
    return undefined;
  }

  return (
    <p
      className={
        result.status === "magic_link_sent"
          ? "text-sm leading-6 text-foreground"
          : "text-sm leading-6 text-destructive"
      }
      role="status"
    >
      {result.message}
    </p>
  );
}

function AuthConfigurationStatus({ auth }: { auth: AuthProviderStatus }) {
  return (
    <div className="mt-6 flex flex-wrap gap-2 border-t pt-4 text-sm leading-6 text-muted-foreground">
      <Badge variant={auth.databaseConfigured ? "secondary" : "outline"}>
        Database {auth.databaseConfigured ? "configured" : "not configured"}
      </Badge>
      <Badge variant={auth.googleConfigured ? "secondary" : "outline"}>
        Google OAuth {auth.googleConfigured ? "configured" : "not configured"}
      </Badge>
      <Badge variant={auth.emailMagicLinkConfigured ? "secondary" : "outline"}>
        Email magic links{" "}
        {auth.emailMagicLinkConfigured ? "configured" : "not configured"}
      </Badge>
    </div>
  );
}
