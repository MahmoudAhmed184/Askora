import { AlertCircle, Link2 } from "lucide-react";
import { useState } from "react";
import { data, redirect, useActionData } from "react-router";

import type { Route } from "./+types/setup.route";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "~/components/ui/alert/alert";
import {
  Avatar,
  AvatarFallback,
} from "~/components/ui/avatar/avatar";
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
  type ProfileSetupFormValues,
} from "~/features/profile-setup/services/profile-setup.service.server";
import { createSetupShareAccessCookieHeader } from "~/features/profile-setup/services/setup-share-access.service.server";
import { getPublicAppConfig } from "~/lib/config.server";

interface SetupActionData {
  setup: ProfileSetupFormResult;
}

export function loader({ context }: Route.LoaderArgs) {
  const session = requireIncompleteProfileSessionFromContext(context);

  if (session instanceof Response) {
    return session;
  }

  return {
    appHost: new URL(getPublicAppConfig().appUrl).host,
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
  return [{ title: "Set up profile | Askora" }];
}

export default function SetupRoute({ loaderData }: Route.ComponentProps) {
  const actionData = useActionData<typeof action>();
  const [previewValues, setPreviewValues] = useState<ProfileSetupFormValues>(
    actionData?.setup.values ?? loaderData.defaults,
  );

  return (
    <OnboardingShell activeStep="profile">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)] lg:items-start lg:gap-10">
        <section className="flex min-w-0 flex-col gap-6">
          <div className="flex flex-col gap-3">
            <h1 className="max-w-xl font-serif text-3xl font-extrabold leading-tight text-foreground sm:text-4xl">
              Choose the profile people will use to ask you questions.
            </h1>
            <p className="max-w-xl text-base leading-7 text-muted-foreground">
              Pick a username and display name to claim your public link — the
              bio can wait.
            </p>
          </div>

          {loaderData.isSuspended ? <SuspendedNotice /> : undefined}
          <SetupFormError result={actionData?.setup} />

          <SetupForm
            defaults={loaderData.defaults}
            disabled={loaderData.isSuspended}
            onValuesChange={setPreviewValues}
            result={actionData?.setup}
          />
        </section>

        <SetupLivePreview
          appHost={loaderData.appHost}
          values={previewValues}
        />
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
    <Alert variant="warning">
      <AlertCircle aria-hidden="true" />
      <AlertTitle>Account suspended</AlertTitle>
      <AlertDescription>
        Profile setup is locked while this account is suspended.
      </AlertDescription>
    </Alert>
  );
}

function SetupFormError({
  result,
}: {
  result: ProfileSetupFormResult | undefined;
}) {
  if (result?.formError === undefined) {
    return null;
  }

  return (
    <Alert variant="destructive">
      <AlertCircle aria-hidden="true" />
      <AlertTitle>Profile could not be created</AlertTitle>
      <AlertDescription>{result.formError}</AlertDescription>
    </Alert>
  );
}

function SetupLivePreview({
  appHost,
  values,
}: {
  appHost: string;
  values: ProfileSetupFormValues;
}) {
  const username = values.username.trim() || "username";
  const displayName = values.displayName.trim() || "Your name";
  const bio = values.bio.trim();

  return (
    <aside
      aria-label="Live profile preview"
      className="flex flex-col gap-3 lg:sticky lg:top-24"
    >
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
        Preview — how visitors see you
      </p>
      <div className="overflow-hidden rounded-3xl border bg-card text-card-foreground shadow-[var(--shadow-card)]">
        <div aria-hidden="true" className="h-20 bg-[image:var(--gradient-brand)]" />
        <div className="flex flex-col gap-3 p-5">
          <Avatar className="-mt-12 size-16 border-4 border-card text-xl">
            <AvatarFallback>{getInitial(displayName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate font-serif text-xl font-extrabold text-foreground">
              {displayName}
            </p>
            <p className="truncate font-mono text-xs text-muted-foreground">
              @{username}
            </p>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            {bio.length > 0 ? (
              bio
            ) : (
              <span className="italic opacity-70">
                Your bio appears here.
              </span>
            )}
          </p>
          <div className="flex min-w-0 items-center gap-2 rounded-full border bg-surface px-3 py-2">
            <Link2
              aria-hidden="true"
              className="size-4 shrink-0 text-primary"
            />
            <span className="truncate font-mono text-xs font-semibold text-foreground">
              {appHost}/{username}
            </span>
          </div>
        </div>
      </div>
      <p className="text-xs leading-5 text-muted-foreground">
        New profiles accept questions by default, including anonymous ones.
        You can adjust that anytime in settings.
      </p>
    </aside>
  );
}

function getInitial(value: string) {
  return value.trim().slice(0, 1).toUpperCase() || "Q";
}
