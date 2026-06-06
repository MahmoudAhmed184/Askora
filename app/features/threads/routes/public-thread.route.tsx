import { data, redirect } from "react-router";

import { getCurrentSessionSummaryFromContext } from "~/features/auth/auth.server";
import { loadAppShellData } from "~/features/dashboard/app-shell.server";
import { PublicThread } from "~/features/threads/components/public-thread";
import { loadPublicThreadPage } from "~/features/threads/public-thread.loader.server";
import {
  createPublicThreadHeaders,
  createPublicThreadMeta,
} from "~/features/threads/public-thread-meta";
import { getPublicAppConfig } from "~/lib/config.server";
import { noindexHeaders } from "~/lib/response.server";

import type { Route } from "./+types/public-thread.route";

export async function loader({ context, params, request }: Route.LoaderArgs) {
  const username = params.username;
  const threadPublicId = params.threadPublicId;
  const session = getCurrentSessionSummaryFromContext(context);
  const shellPromise =
    session.status === "authenticated" && session.profileStatus === "complete"
      ? loadAppShellData({ session })
      : Promise.resolve(undefined);
  const result = await loadPublicThreadPage({
    session,
    threadPublicId,
    username,
  });

  if (result.status === "redirect") {
    return redirect(`/${result.username}/a/${threadPublicId}`);
  }

  const responseInit =
    result.page.status === "unavailable"
      ? {
          headers: noindexHeaders(),
          status: result.responseStatus,
        }
      : {
          status: result.responseStatus,
        };

  return data(
    {
      app: getPublicAppConfig(),
      closeHref: getThreadPopupCloseHref(request),
      page: result.page,
      shell: await shellPromise,
    },
    responseInit,
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
      closeHref={loaderData.closeHref}
      page={loaderData.page}
      shell={loaderData.shell}
    />
  );
}

function getThreadPopupCloseHref(request: Request) {
  const returnTo = new URL(request.url).searchParams.get("returnTo");

  if (
    returnTo === null ||
    !returnTo.startsWith("/") ||
    returnTo.startsWith("//")
  ) {
    return "/dashboard/feed";
  }

  return returnTo;
}
