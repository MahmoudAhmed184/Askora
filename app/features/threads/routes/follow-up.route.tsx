import { ArrowLeft, LockKeyhole } from "lucide-react";
import { data, Link, redirect } from "react-router";

import { PublicShell } from "~/components/app/public-shell";
import { Button } from "~/components/ui/button";
import { FollowUpComposer } from "~/features/threads/components/follow-up-composer";
import { ThreadContextPreview } from "~/features/threads/components/thread-context-preview";
import {
  clearFollowUpFlashCookieHeader,
  createFollowUpFlashCookieHeader,
  getFollowUpFlashForResult,
  hasFollowUpFlashCookie,
  loadFollowUpPage,
  readFollowUpFlashFromRequest,
  submitThreadFollowUp,
  type FollowUpPageData,
} from "~/features/threads/follow-up.server";
import type { PublicThreadFollowUpState } from "~/features/threads/thread-permissions.server";
import { getPublicAppConfig } from "~/lib/config.server";
import { noindexHeaders } from "~/lib/response.server";

import type { Route } from "./+types/follow-up.route";

export async function loader({ params, request }: Route.LoaderArgs) {
  const username = params.username;
  const threadPublicId = params.threadPublicId;
  const { getCurrentSessionSummary } = await import(
    "~/features/auth/auth.server"
  );
  const session = await getCurrentSessionSummary(request);
  const headers = new Headers();

  if (hasFollowUpFlashCookie(request)) {
    headers.append("Set-Cookie", clearFollowUpFlashCookieHeader());
  }

  const result = await loadFollowUpPage({
    flash: readFollowUpFlashFromRequest({
      request,
      threadPublicId,
      username,
    }),
    session,
    threadPublicId,
    username,
  });

  if (result.status === "redirect") {
    return redirect(`/${result.username}/a/${threadPublicId}/follow-ups`, {
      headers,
    });
  }

  return data(
    {
      app: getPublicAppConfig(),
      page: result.page,
    },
    {
      headers,
      status: result.responseStatus,
    },
  );
}

export async function action({ params, request }: Route.ActionArgs) {
  const username = params.username;
  const threadPublicId = params.threadPublicId;
  const { getCurrentSessionSummary } = await import(
    "~/features/auth/auth.server"
  );
  const session = await getCurrentSessionSummary(request);
  const result = await submitThreadFollowUp({
    formData: await request.formData(),
    request,
    session,
    threadPublicId,
    username,
  });

  if (result.status === "redirect") {
    return redirect(`/${result.username}/a/${threadPublicId}/follow-ups`);
  }

  const headers = new Headers();

  headers.append(
    "Set-Cookie",
    createFollowUpFlashCookieHeader({
      result: getFollowUpFlashForResult({ result, session }),
      threadPublicId,
      username,
    }),
  );

  return redirect(`/${username}/a/${threadPublicId}/follow-ups#follow-up`, {
    headers,
  });
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
      { title: `Follow-up unavailable | ${appName}` },
      { name: "robots", content: "noindex,nofollow" },
    ];
  }

  const tags: Record<string, string>[] = [
    {
      title: `Ask a follow-up for @${loaderData.page.profile.username} | ${appName}`,
    },
  ];

  if (loaderData.app.betaNoindex) {
    tags.push({ name: "robots", content: "noindex,nofollow" });
  }

  return tags;
}

export default function FollowUpRoute({ loaderData }: Route.ComponentProps) {
  if (loaderData.page.status === "unavailable") {
    return <UnavailableFollowUp page={loaderData.page} />;
  }

  const { page } = loaderData;

  return (
    <PublicShell>
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-4 border-b pb-5">
          <Button asChild className="w-fit" size="sm" variant="outline">
            <Link to={`/${page.profile.username}/a/${page.thread.publicId}`}>
              <ArrowLeft data-icon="inline-start" />
              Back to thread
            </Link>
          </Button>
          <div className="flex min-w-0 gap-4">
            <ProfileAvatar profile={page.profile} />
            <div className="flex min-w-0 flex-col gap-2">
              <h1 className="break-words text-3xl font-semibold leading-tight">
                Ask a follow-up
              </h1>
              <p className="break-words text-sm leading-6 text-muted-foreground">
                Continue the thread with{" "}
                <Link
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                  to={`/${page.profile.username}`}
                >
                  {page.profile.displayName} (@{page.profile.username})
                </Link>
              </p>
            </div>
          </div>
        </header>

        <ThreadContextPreview context={page.context} />

        {page.followUp.status === "allowed" ? (
          <FollowUpComposer
            flash={page.flash}
            followUp={page.followUp}
            profile={page.profile}
            timingToken={page.timingToken ?? ""}
          />
        ) : (
          <FollowUpUnavailableState followUp={page.followUp} />
        )}
      </div>
    </PublicShell>
  );
}

function UnavailableFollowUp({
  page,
}: {
  page: Extract<FollowUpPageData, { status: "unavailable" }>;
}) {
  return (
    <PublicShell>
      <section className="mx-auto flex min-h-[50svh] max-w-xl flex-col justify-center gap-3 py-10">
        <p className="break-all text-sm font-medium text-muted-foreground">
          @{page.username}
        </p>
        <h1 className="text-3xl font-semibold leading-tight">
          This thread is unavailable
        </h1>
        <p className="text-sm leading-6 text-muted-foreground">
          The answer thread may have been removed, unpublished, or made
          unavailable by the profile owner.
        </p>
      </section>
    </PublicShell>
  );
}

function FollowUpUnavailableState({
  followUp,
}: {
  followUp: PublicThreadFollowUpState;
}) {
  if (followUp.status === "allowed") {
    return null;
  }

  return (
    <section className="flex flex-col items-start gap-4 rounded-lg border border-dashed bg-background p-5">
      <div className="flex flex-col gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <LockKeyhole aria-hidden="true" className="size-4" />
          Follow-ups unavailable
        </h2>
        <p className="max-w-prose text-sm leading-6 text-muted-foreground">
          {followUp.message}
        </p>
      </div>
      {followUp.action === undefined ? null : (
        <Button asChild variant="outline">
          <Link to={followUp.action.href}>{followUp.action.label}</Link>
        </Button>
      )}
    </section>
  );
}

function ProfileAvatar({
  profile,
}: {
  profile: {
    avatarUrl: string | null;
    displayName: string;
  };
}) {
  if (profile.avatarUrl !== null) {
    return (
      <img
        alt=""
        className="size-14 shrink-0 rounded-lg border bg-muted object-cover"
        src={profile.avatarUrl}
      />
    );
  }

  return (
    <span className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-primary text-xl font-semibold text-primary-foreground">
      {profile.displayName.slice(0, 1).toUpperCase()}
    </span>
  );
}
