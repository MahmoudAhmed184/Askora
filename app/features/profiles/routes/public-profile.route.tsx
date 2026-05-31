import { data, redirect } from "react-router";

import { PublicShell } from "~/components/app/public-shell";
import type { CurrentSessionSummary } from "~/features/auth/auth.server";
import { AskComposer } from "~/features/profiles/components/ask-composer";
import { PermissionState } from "~/features/profiles/components/permission-state";
import {
  BetaNoindexBadge,
  ProfileHeader,
} from "~/features/profiles/components/profile-header";
import { PublicAnswerList } from "~/features/profiles/components/public-answer-list";
import { UnavailableProfile } from "~/features/profiles/components/unavailable-profile";
import { findPublishedAnswersForProfile } from "~/features/answers/answer.server";
import {
  clearPublicAskFlashCookieHeader,
  hasPublicAskFlashCookie,
  readPublicAskFlashFromRequest,
} from "~/features/profiles/ask-friction.server";
import {
  createPublicProfilePageData,
  resolvePublicProfile,
} from "~/features/profiles/profile.loader.server";
import { getPublishedAnswerControlState } from "~/features/answers/published-answer-controls.server";
import { findPublicProfileSocialStats } from "~/features/social/social-data.server";
import {
  createPublicNoindexHeaders,
  createRobotsMetaTag,
} from "~/features/threads/public-thread-meta";
import { getPublicAppConfig } from "~/lib/config.server";

import type { Route } from "./+types/public-profile.route";

export async function loader({ params, request }: Route.LoaderArgs) {
  const username = params.username;

  const { getCurrentSessionSummary } = await import(
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
        headers: createPublicNoindexHeaders({
          loaderHeaders: headers,
          noindex: true,
        }),
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
      {
        headers: createPublicNoindexHeaders({
          loaderHeaders: headers,
          noindex: true,
        }),
      },
    );
  }

  const [publishedAnswers, social] = await Promise.all([
    findPublishedAnswersForProfile({
      profileId: resolution.profile.id,
      session,
    }),
    findPublicProfileSocialStats({
      profileId: resolution.profile.id,
      viewerProfileId: getViewerProfileId(session),
    }),
  ]);

  return data(
    {
      app: getPublicAppConfig(),
      page: createPublicProfilePageData({
        askFlash: readPublicAskFlashFromRequest(request, username),
        profile: resolution.profile,
        publishedAnswerControls: getPublishedAnswerControlState({
          owner: resolution.profile,
          session,
        }),
        publishedAnswers,
        session,
        social,
      }),
    },
    { headers },
  );
}

function getViewerProfileId(session: CurrentSessionSummary) {
  return session.status === "authenticated" && session.profileStatus === "complete"
    ? session.profile.id
    : undefined;
}

export function headers({ loaderHeaders }: Route.HeadersArgs) {
  return createPublicNoindexHeaders({
    loaderHeaders,
    noindex: getPublicAppConfig().betaNoindex,
  });
}

export function meta({ loaderData }: Route.MetaArgs) {
  const appName = loaderData.app.appName;

  if (loaderData.page.status !== "available") {
    const tags: ({ title: string } | { name: string; content: string })[] = [
      { title: `Profile unavailable | ${appName}` },
    ];
    const robotsMeta = createRobotsMetaTag(true);

    if (robotsMeta !== undefined) {
      tags.push(robotsMeta);
    }

    return tags;
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

  const robotsMeta = createRobotsMetaTag(loaderData.app.betaNoindex);

  if (robotsMeta !== undefined) {
    tags.push(robotsMeta);
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
        <ProfileHeader follow={page.follow} profile={page.profile} />
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
        <PublicAnswerList
          answers={page.publishedAnswers}
          controls={page.publishedAnswerControls}
          profileUsername={page.profile.username}
        />
      </div>
    </PublicShell>
  );
}
