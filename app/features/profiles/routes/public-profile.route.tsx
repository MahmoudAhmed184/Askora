import { data, redirect } from "react-router";

import { DashboardShell } from "~/components/app/dashboard-shell";
import { PublicShell } from "~/components/app/public-shell";
import {
  getCurrentSessionSummaryFromContext,
  type CurrentSessionSummary,
} from "~/features/auth/auth.server";
import {
  AskComposer,
} from "~/features/profiles/components/ask-composer";
import { PermissionState } from "~/features/profiles/components/permission-state";
import {
  BetaNoindexBadge,
  ProfileHeader,
} from "~/features/profiles/components/profile-header";
import { ProfileSideRail } from "~/features/profiles/components/profile-side-rail";
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
import { loadAppShellData } from "~/features/dashboard/app-shell.server";
import {
  createPublicNoindexHeaders,
  createRobotsMetaTag,
} from "~/features/threads/public-thread-meta";
import { getPublicAppConfig } from "~/lib/config.server";

import type { Route } from "./+types/public-profile.route";

export async function loader({ context, params, request }: Route.LoaderArgs) {
  const username = params.username;
  const session = getCurrentSessionSummaryFromContext(context);

  const resolution = await resolvePublicProfile({ username });
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
        shell: await loadShellForSession(session),
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
        shell: await loadShellForSession(session),
      },
      {
        headers: createPublicNoindexHeaders({
          loaderHeaders: headers,
          noindex: true,
        }),
      },
    );
  }

  const completedSession =
    session.status === "authenticated" && session.profileStatus === "complete"
      ? session
      : undefined;
  const [publishedAnswers, social, shell] = await Promise.all([
    findPublishedAnswersForProfile({
      profileId: resolution.profile.id,
      session,
    }),
    findPublicProfileSocialStats({
      profileId: resolution.profile.id,
      viewerProfileId: getViewerProfileId(session),
    }),
    completedSession === undefined
      ? undefined
      : loadAppShellData({ session: completedSession }),
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
      shell,
    },
    { headers },
  );
}

function getViewerProfileId(session: CurrentSessionSummary) {
  return session.status === "authenticated" && session.profileStatus === "complete"
    ? session.profile.id
    : undefined;
}

function loadShellForSession(session: CurrentSessionSummary) {
  return session.status === "authenticated" && session.profileStatus === "complete"
    ? loadAppShellData({ session })
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
    const content = <UnavailableProfile username={loaderData.page.username} />;

    if (loaderData.shell !== undefined) {
      return <DashboardShell shell={loaderData.shell}>{content}</DashboardShell>;
    }

    return <PublicShell>{content}</PublicShell>;
  }

  const { page } = loaderData;
  const isOwnerView = page.publishedAnswerControls.canManage;
  const hasPinnedAnswers = page.publishedAnswers.some(
    (answer) => answer.pinPosition !== null,
  );
  const content = (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      {loaderData.app.betaNoindex ? (
        <div className="flex justify-end">
          <BetaNoindexBadge />
        </div>
      ) : null}
      <ProfileHeader
        follow={page.follow}
        isOwnerView={isOwnerView}
        profile={page.profile}
      />
      <div
        className={
          hasPinnedAnswers
            ? "grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start"
            : "flex flex-col gap-6"
        }
      >
        <div className="flex min-w-0 flex-col gap-6">
          {renderAskSurface({ isOwnerView, page })}
          <div>
            <PublicAnswerList
              answers={page.publishedAnswers}
              controls={page.publishedAnswerControls}
              profileUsername={page.profile.username}
            />
          </div>
        </div>
        {hasPinnedAnswers ? (
          <ProfileSideRail
            answers={page.publishedAnswers}
            profile={page.profile}
          />
        ) : null}
      </div>
    </div>
  );

  if (loaderData.shell !== undefined) {
    return <DashboardShell shell={loaderData.shell}>{content}</DashboardShell>;
  }

  return (
    <PublicShell>
      {content}
    </PublicShell>
  );
}

function renderAskSurface({
  isOwnerView,
  page,
}: {
  isOwnerView: boolean;
  page: Extract<Route.ComponentProps["loaderData"]["page"], { status: "available" }>;
}) {
  if (page.ask.status !== "allowed") {
    return isOwnerView ? null : <PermissionState ask={page.ask} />;
  }

  if (isOwnerView) {
    return null;
  }

  return (
    <AskComposer
      ask={page.ask}
      flash={page.askFlash}
      profile={page.profile}
      timingToken={page.timingToken ?? ""}
    />
  );
}
