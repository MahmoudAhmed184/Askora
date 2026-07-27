import { data, redirect, useRouteLoaderData } from "react-router";

import { getCurrentSessionSummaryFromContext } from "~/features/auth/services/auth.service.server";
import { appShellRouteHandle } from "~/features/app-shell/app-shell-route";
import { PublicThread } from "~/features/threads/components/public-thread";
import { loadPublicThreadPage } from "~/features/threads/queries/public-thread.queries.server";
import {
  createPublicThreadHeaders,
  createPublicThreadMeta,
} from "~/features/threads/public-thread-meta";
import { getPublicAppConfig } from "~/lib/config.server";
import { noindexHeaders } from "~/lib/response.server";
import type { loader as rootLoader } from "~/root";

import type { Route } from "./+types/public-thread.route";

export async function loader({ context, params }: Route.LoaderArgs) {
  const username = params.username;
  const threadPublicId = params.threadPublicId;
  const session = getCurrentSessionSummaryFromContext(context);
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
      page: result.page,
    },
    responseInit,
  );
}

export const handle = appShellRouteHandle;

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
  const rootData = useRouteLoaderData<typeof rootLoader>("root");

  return (
    <PublicThread
      betaNoindex={loaderData.app.betaNoindex}
      page={loaderData.page}
      shell={rootData?.shell}
    />
  );
}
