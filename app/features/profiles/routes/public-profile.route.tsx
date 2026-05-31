import { data, redirect } from "react-router";

import { PublicShell } from "~/components/app/public-shell";
import { AskComposer } from "~/features/profiles/components/ask-composer";
import { PermissionState } from "~/features/profiles/components/permission-state";
import {
  BetaNoindexBadge,
  ProfileHeader,
} from "~/features/profiles/components/profile-header";
import { PublicAnswerList } from "~/features/profiles/components/public-answer-list";
import { UnavailableProfile } from "~/features/profiles/components/unavailable-profile";
import {
  clearPublicAskFlashCookieHeader,
  hasPublicAskFlashCookie,
  readPublicAskFlashFromRequest,
} from "~/features/profiles/ask-friction.server";
import {
  createPublicProfilePageData,
  resolvePublicProfile,
} from "~/features/profiles/profile.loader.server";
import { getPublicAppConfig } from "~/lib/config.server";
import { noindexHeaders } from "~/lib/response.server";

import type { Route } from "./+types/public-profile.route";

export async function loader({ params, request }: Route.LoaderArgs) {
  const username = params.username;

  const { getCurrentSessionSummary, toPublicSessionSummary } = await import(
    "~/features/auth/auth.server"
  );
  const [resolution, session] = await Promise.all([
    resolvePublicProfile({ username }),
    getCurrentSessionSummary(request),
  ]);
  const headers = new Headers();

  if (hasPublicAskFlashCookie(request)) {
    headers.append("Set-Cookie", clearPublicAskFlashCookieHeader());
  }

  if (resolution.status === "redirect") {
    return redirect(`/${resolution.username}`);
  }

  if (resolution.status === "not_found") {
    return data(
      {
        app: getPublicAppConfig(),
        page: {
          status: "unavailable" as const,
          username: resolution.username,
        },
      },
      {
        headers,
        status: 404,
      },
    );
  }

  if (resolution.status === "unavailable") {
    return data(
      {
        app: getPublicAppConfig(),
        page: {
          status: "unavailable" as const,
          username: resolution.username,
        },
      },
      { headers },
    );
  }

  return data(
    {
      app: getPublicAppConfig(),
      page: createPublicProfilePageData({
        askFlash: readPublicAskFlashFromRequest(request, username),
        profile: resolution.profile,
        session: toPublicSessionSummary(session),
      }),
    },
    { headers },
  );
}

export function headers({ loaderHeaders }: Route.HeadersArgs) {
  const headers = new Headers(loaderHeaders);

  if (getPublicAppConfig().betaNoindex) {
    for (const [name, value] of Object.entries(noindexHeaders())) {
      headers.set(name, value);
    }
  }

  return headers;
}

export function meta({ loaderData }: Route.MetaArgs) {
  const appName = loaderData.app.appName;

  if (loaderData.page.status !== "available") {
    return [
      { title: `Profile unavailable | ${appName}` },
      { name: "robots", content: "noindex,nofollow" },
    ];
  }

  const { profile } = loaderData.page;
  const tags = [
    { title: `${profile.displayName} (@${profile.username}) | ${appName}` },
    {
      name: "description",
      content:
        profile.bio ??
        `Ask ${profile.displayName} a question on ${appName}.`,
    },
  ];

  if (loaderData.app.betaNoindex) {
    tags.push({ name: "robots", content: "noindex,nofollow" });
  }

  return tags;
}

export default function PublicProfileRoute({ loaderData }: Route.ComponentProps) {
  if (loaderData.page.status === "unavailable") {
    return <UnavailableProfile username={loaderData.page.username} />;
  }

  const { page } = loaderData;

  return (
    <PublicShell>
      <div className="flex flex-col gap-6">
        <div className="flex justify-end">
          {loaderData.app.betaNoindex ? <BetaNoindexBadge /> : null}
        </div>
        <ProfileHeader profile={page.profile} />
        {page.ask.status === "allowed" ? (
          <AskComposer
            ask={page.ask}
            flash={page.askFlash}
            profile={page.profile}
            timingToken={page.timingToken ?? ""}
          />
        ) : (
          <PermissionState ask={page.ask} />
        )}
        <PublicAnswerList />
      </div>
    </PublicShell>
  );
}
