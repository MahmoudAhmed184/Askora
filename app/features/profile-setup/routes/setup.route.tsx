import { AlertTriangle, ArrowRight, Link2, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { data, Link, redirect, useActionData } from "react-router";

import type { Route } from "./+types/setup.route";
import { SetupForm } from "~/features/profile-setup/components/setup-form";
import {
  getProfileSetupDefaults,
  submitProfileSetup,
  type ProfileSetupFormResult,
} from "~/features/profile-setup/profile-setup.server";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";

interface SetupActionData {
  setup: ProfileSetupFormResult;
}

export async function loader({ request }: Route.LoaderArgs) {
  const { isSessionSuspended, requireIncompleteProfileSession } = await import(
    "~/features/auth/auth.server"
  );
  const session = await requireIncompleteProfileSession(request);

  if (session instanceof Response) {
    return session;
  }

  return {
    defaults: getProfileSetupDefaults(session.user),
    isSuspended: isSessionSuspended(session),
  };
}

export async function action({ request }: Route.ActionArgs) {
  const { requireIncompleteProfileSession } = await import(
    "~/features/auth/auth.server"
  );
  const session = await requireIncompleteProfileSession(request);

  if (session instanceof Response) {
    return session;
  }

  const result = await submitProfileSetup({
    formData: await request.formData(),
    session,
  });

  if (result.status === "created") {
    return redirect("/setup/share");
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
    <OnboardingShell>
      <div className="grid gap-10 py-4 lg:min-h-[calc(100svh-10rem)] lg:grid-cols-[minmax(0,0.92fr)_minmax(340px,0.68fr)] lg:items-center">
        <section className="flex max-w-2xl flex-col gap-6">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">Profile setup</Badge>
            <Badge variant="outline">One public link</Badge>
          </div>
          <div className="flex flex-col gap-4">
            <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
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
    <div className="flex items-start gap-3 border-l px-4 py-1 text-sm leading-6 text-muted-foreground">
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
    <aside aria-label="Profile setup preview" className="border-y py-6 lg:pl-6">
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

function OnboardingShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b bg-background/90">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <Link className="flex items-center gap-2.5 text-sm font-semibold" to="/">
            <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground">
              Q
            </span>
            <span>Q&A Platform</span>
          </Link>
          <span className="text-sm text-muted-foreground">Setup</span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 sm:py-12">
        {children}
      </main>
    </div>
  );
}
