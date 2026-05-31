import { data, redirect } from "react-router";

import { PublicThread } from "~/features/threads/components/public-thread";
import { loadPublicThreadPage } from "~/features/threads/public-thread.loader.server";
import {
  createPublicThreadHeaders,
  createPublicThreadMeta,
} from "~/features/threads/public-thread-meta";
import { getPublicAppConfig } from "~/lib/config.server";

import type { Route } from "./+types/public-thread.route";

export async function loader({ params, request }: Route.LoaderArgs) {
  const username = params.username;
  const threadPublicId = params.threadPublicId;
  const { getCurrentSessionSummary } = await import(
    "~/features/auth/auth.server"
  );
  const result = await loadPublicThreadPage({
    session: await getCurrentSessionSummary(request),
    threadPublicId,
    username,
  });

  if (result.status === "redirect") {
    return redirect(`/${result.username}/a/${threadPublicId}`);
  }

  return data(
    {
      app: getPublicAppConfig(),
      page: result.page,
    },
    {
      status: result.responseStatus,
    },
  );
}

export function headers({ loaderHeaders }: Route.HeadersArgs) {
  return createPublicThreadHeaders({
    app: getPublicAppConfig(),
    loaderHeaders,
  });
}

export function meta({ loaderData }: Route.MetaArgs) {
  return createPublicThreadMeta({
    app: loaderData.app,
    page: loaderData.page,
  });
}

export default function PublicThreadRoute({ loaderData }: Route.ComponentProps) {
  return (
    <PublicThread
      betaNoindex={loaderData.app.betaNoindex}
      page={loaderData.page}
    />
  );
}
