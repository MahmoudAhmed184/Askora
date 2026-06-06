import { KeyRound, LogIn, Mail } from "lucide-react";
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
import { Separator } from "~/components/ui/separator";
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
}

export function LoginPanel({ auth }: LoginPanelProps) {
  const googleReady = auth.databaseConfigured && auth.googleConfigured;
  const emailReady = auth.databaseConfigured && auth.emailMagicLinkConfigured;

  return (
    <section
      aria-labelledby="login-heading"
      className="rounded-3xl border bg-card p-6 text-card-foreground shadow-[var(--shadow-card)] sm:p-7"
    >
      <header>
        <h2
          className="font-serif text-3xl font-extrabold leading-tight text-foreground"
          id="login-heading"
        >
          Sign in to continue
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Use Google for the fastest route in. Magic links are available when
          email is easier.
        </p>
      </header>
      <Separator className="mt-5" />

      <Form className="mt-6" method="post">
        <FieldGroup className="gap-5">
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
            <LogIn data-icon="inline-start" />
            Continue with Google
          </PendingButton>

          <Separator />

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

        </FieldGroup>
      </Form>

      <AuthConfigurationStatus auth={auth} />
    </section>
  );
}

function AuthConfigurationStatus({ auth }: { auth: AuthProviderStatus }) {
  if (
    auth.databaseConfigured &&
    auth.googleConfigured &&
    auth.emailMagicLinkConfigured
  ) {
    return null;
  }

  return (
    <div className="mt-6 flex flex-col gap-5">
      <Separator />
      <div className="flex flex-wrap gap-2 text-sm leading-6 text-muted-foreground">
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
    </div>
  );
}
