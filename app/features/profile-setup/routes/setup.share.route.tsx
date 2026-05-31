import { ArrowRight, CheckCircle2, Link2 } from "lucide-react";
import { Link } from "react-router";

import type { Route } from "./+types/setup.share.route";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { ShareProfilePanel } from "~/features/profile-setup/components/share-profile-panel";
import { createCanonicalProfileUrl } from "~/features/profile-setup/profile-setup.server";
import { getPublicAppConfig } from "~/lib/config.server";

export async function loader({ request }: Route.LoaderArgs) {
  const { requireCompletedProfileSession } = await import(
    "~/features/auth/auth.server"
  );
  const session = await requireCompletedProfileSession(request);

  if (session instanceof Response) {
    return session;
  }

  return {
    canonicalUrl: createCanonicalProfileUrl(
      getPublicAppConfig().appUrl,
      session.profile.username,
    ),
    profile: {
      username: session.profile.username,
      displayName: session.profile.displayName,
    },
  };
}

export function meta() {
  return [{ title: "Share profile | qna-platform" }];
}

export default function SetupShareRoute({ loaderData }: Route.ComponentProps) {
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
          <Badge className="gap-1.5" variant="secondary">
            <CheckCircle2 aria-hidden="true" className="size-3.5" />
            Profile ready
          </Badge>
        </div>
      </header>
      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-10 px-5 py-8 sm:py-12 lg:min-h-[calc(100svh-5rem)] lg:grid-cols-[minmax(0,0.95fr)_minmax(340px,0.62fr)] lg:items-center">
        <ShareProfilePanel
          canonicalUrl={loaderData.canonicalUrl}
          displayName={loaderData.profile.displayName}
        />

        <aside aria-label="Next steps" className="border-y py-6 lg:pl-6">
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
          </div>
        </aside>
      </main>
    </div>
  );
}
