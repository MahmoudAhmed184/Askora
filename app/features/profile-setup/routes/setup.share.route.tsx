import { ArrowRight, Link2 } from "lucide-react";
import { data, Link, redirect } from "react-router";

import type { Route } from "./+types/setup.share.route";
import { Button } from "~/components/ui/button";
import { requireCompletedProfileSessionFromContext } from "~/features/auth/auth.server";
import { OnboardingShell } from "~/features/profile-setup/components/onboarding-shell";
import { ShareProfilePanel } from "~/features/profile-setup/components/share-profile-panel";
import { createCanonicalProfileUrl } from "~/features/profile-setup/profile-setup.server";
import {
  clearSetupShareAccessCookieHeader,
  hasSetupShareAccess,
} from "~/features/profile-setup/setup-share-access.server";
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
    return redirect("/dashboard/feed");
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
      <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] lg:items-start">
        <div className="min-w-0">
          <ShareProfilePanel
            canonicalUrl={loaderData.canonicalUrl}
            displayName={loaderData.profile.displayName}
          />
        </div>

        <aside
          aria-label="Next steps"
          className="rounded-3xl border bg-card p-6 shadow-[var(--shadow-card)] lg:p-7"
        >
          <div className="flex flex-col gap-5">
            <div className="flex size-12 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
              <Link2 aria-hidden="true" className="size-5" />
            </div>
            <div className="flex flex-col gap-2">
              <h2 className="text-2xl font-semibold leading-tight">
                @{loaderData.profile.username}
              </h2>
              <p className="text-sm leading-6 text-muted-foreground">
                Your username and profile URL are reserved. More profile tools
                will appear here as the beta opens.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link to="/privacy">
                Review privacy
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
            <Button asChild>
              <Link to="/dashboard/feed">
                Continue to Feed
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          </div>
        </aside>
      </div>
    </OnboardingShell>
  );
}
