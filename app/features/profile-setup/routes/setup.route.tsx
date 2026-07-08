import { AlertTriangle, ArrowRight, Link2, ShieldCheck } from "lucide-react";
import { data, Link, redirect, useActionData } from "react-router";

import type { Route } from "./+types/setup.route";
import { ActionToast } from "~/components/shared/action-toast/action-toast";
import {
  isSessionSuspended,
  requireIncompleteProfileSessionFromContext,
} from "~/features/auth/services/auth.service.server";
import { OnboardingShell } from "~/features/profile-setup/components/onboarding-shell";
import { SetupForm } from "~/features/profile-setup/components/setup-form";
import {
  getProfileSetupDefaults,
  submitProfileSetup,
  type ProfileSetupFormResult,
} from "~/features/profile-setup/services/profile-setup.service.server";
import { createSetupShareAccessCookieHeader } from "~/features/profile-setup/services/setup-share-access.service.server";
import { Badge } from "~/components/ui/badge/badge";
import { Button } from "~/components/ui/button/button";

interface SetupActionData {
  setup: ProfileSetupFormResult;
}

export function loader({ context }: Route.LoaderArgs) {
  const session = requireIncompleteProfileSessionFromContext(context);

  if (session instanceof Response) {
    return session;
  }

  return {
    defaults: getProfileSetupDefaults(session.user),
    isSuspended: isSessionSuspended(session),
  };
}

export async function action({ context, request }: Route.ActionArgs) {
  const session = requireIncompleteProfileSessionFromContext(context);

  if (session instanceof Response) {
    return session;
  }

  const result = await submitProfileSetup({
    formData: await request.formData(),
    session,
  });

  if (result.status === "created") {
    return redirect("/setup/share", {
      headers: {
        "Set-Cookie": createSetupShareAccessCookieHeader(result.profile.id),
      },
    });
  }

  return data<SetupActionData>(
    { setup: result },
    { status: getProfileSetupResponseStatus(result) },
  );
}

export function meta() {
  return [{ title: "Set up profile | qna-platform" }];
}

export default function SetupRoute({ loaderData }: Route.ComponentProps) {
  const actionData = useActionData<typeof action>();

  return (
    <OnboardingShell activeStep="profile">
      <ActionToast
        message={actionData?.setup.formError}
        tone="error"
        trigger={actionData?.setup}
      />
      <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] lg:items-start">
        <section className="flex min-w-0 flex-col gap-5">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">Profile setup</Badge>
            <Badge variant="outline">One public link</Badge>
          </div>
          <div className="flex flex-col gap-4">
            <h1 className="font-serif text-4xl font-bold leading-tight text-primary sm:text-5xl">
              Choose the profile people will use to ask you questions.
            </h1>
            <p className="max-w-xl text-base leading-7 text-muted-foreground">
              Usernames are lowercase and stable. Display name and bio can
              change later from profile settings.
            </p>
          </div>

          {loaderData.isSuspended ? <SuspendedNotice /> : undefined}

          <SetupForm
            defaults={loaderData.defaults}
            disabled={loaderData.isSuspended}
            result={actionData?.setup}
          />
        </section>

        <SetupPreview />
      </div>
    </OnboardingShell>
  );
}

function getProfileSetupResponseStatus(result: ProfileSetupFormResult) {
  if (result.status === "suspended") {
    return 403;
  }

  if (result.status === "duplicate_profile") {
    return 409;
  }

  if (result.status === "username_taken") {
    return 409;
  }

  return 400;
}

function SuspendedNotice() {
  return (
    <div className="flex items-start gap-3 rounded-2xl border bg-secondary/70 px-4 py-3 text-sm leading-6 text-muted-foreground">
      <AlertTriangle
        aria-hidden="true"
        className="mt-0.5 size-4 shrink-0 text-destructive"
      />
      Profile setup is locked while this account is suspended.
    </div>
  );
}

function SetupPreview() {
  return (
    <aside
      aria-label="Profile setup preview"
      className="rounded-3xl border bg-card p-6 shadow-[var(--shadow-card)] lg:p-7"
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-3 rounded-full border bg-card px-3 py-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
            <Link2 aria-hidden="true" className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">
              Canonical profile
            </p>
            <p className="truncate text-sm font-semibold">qna.app/username</p>
          </div>
        </div>
        <div className="flex items-start gap-3 text-sm leading-6 text-muted-foreground">
          <ShieldCheck
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-foreground"
          />
          New profiles accept questions by default, including anonymous
          questions. You can adjust those controls later in profile settings.
        </div>
        <Button asChild className="w-full sm:w-auto" variant="outline">
          <Link to="/privacy">
            Privacy stance
            <ArrowRight data-icon="inline-end" />
          </Link>
        </Button>
      </div>
    </aside>
  );
}
