import { ArrowRight, CheckCircle2, Link2 } from "lucide-react";
import { data, Link, redirect } from "react-router";

import type { Route } from "./+types/setup.share.route";
import { Button } from "~/components/ui/button/button";
import { requireCompletedProfileSessionFromContext } from "~/features/auth/services/auth.service.server";
import { OnboardingShell } from "~/features/profile-setup/components/onboarding-shell";
import { ShareProfilePanel } from "~/features/profile-setup/components/share-profile-panel";
import { createCanonicalProfileUrl } from "~/features/profile-setup/services/profile-setup.service.server";
import {
  clearSetupShareAccessCookieHeader,
  hasSetupShareAccess,
} from "~/features/profile-setup/services/setup-share-access.service.server";
import { getPublicAppConfig } from "~/lib/config.server";

export function loader({ context, request }: Route.LoaderArgs) {
  const session = requireCompletedProfileSessionFromContext(context);

  if (session instanceof Response) {
    return session;
  }

  if (
    !hasSetupShareAccess({
      profileId: session.profile.id,
      request,
    })
  ) {
    return redirect("/feed");
  }

  return data(
    {
      canonicalUrl: createCanonicalProfileUrl(
        getPublicAppConfig().appUrl,
        session.profile.username,
      ),
      profile: {
        username: session.profile.username,
        displayName: session.profile.displayName,
      },
    },
    {
      headers: {
        "Set-Cookie": clearSetupShareAccessCookieHeader(),
      },
    },
  );
}

export function meta() {
  return [{ title: "Share profile | qna-platform" }];
}

export default function SetupShareRoute({ loaderData }: Route.ComponentProps) {
  return (
    <OnboardingShell activeStep="share">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-success/10 text-success">
            <CheckCircle2 aria-hidden="true" className="size-7" />
          </span>
          <div className="flex flex-col gap-2">
            <h1 className="font-serif text-3xl font-extrabold leading-tight text-foreground sm:text-4xl">
              You&apos;re live, @{loaderData.profile.username}.
            </h1>
            <p className="mx-auto max-w-md text-base leading-7 text-muted-foreground">
              Your profile link is reserved. Share it anywhere people already
              follow you — questions arrive privately.
            </p>
          </div>
        </div>

        <ShareProfilePanel
          canonicalUrl={loaderData.canonicalUrl}
          displayName={loaderData.profile.displayName}
        />

        <div className="flex flex-col items-center gap-3">
          <Button asChild className="h-11 w-full sm:w-auto sm:px-8">
            <Link to="/feed">
              Continue to your feed
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link to={`/${loaderData.profile.username}`}>
              <Link2 data-icon="inline-start" />
              View your public profile
            </Link>
          </Button>
        </div>
      </div>
    </OnboardingShell>
  );
}
