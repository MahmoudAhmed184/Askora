import type { ReactNode } from "react";
import {
  data,
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteError,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";

import { Toaster } from "~/components/ui/sonner";
import { currentSessionContext } from "~/features/auth/auth.context";
import {
  getCurrentSessionSummary,
  getCurrentSessionSummaryFromContext,
  toPublicSessionSummary,
  type PublicSessionSummary,
} from "~/features/auth/auth.server";
import { getPublicAppConfig, type PublicAppConfig } from "~/lib/config.server";
import {
  createDocumentHeaders,
  mergeNoindexHeaders,
} from "~/lib/response.server";

export interface RootLoaderData {
  app: PublicAppConfig;
  session: PublicSessionSummary;
}

// eslint-disable-next-line react-refresh/only-export-components
export const middleware: Route.MiddlewareFunction[] = [
  async ({ context, request }) => {
    context.set(
      currentSessionContext,
      await getCurrentSessionSummary(request),
    );
  },
];

export function loader({ context, request }: Route.LoaderArgs) {
  const session = getCurrentSessionSummaryFromContext(context);

  const loaderData: RootLoaderData = {
    app: getPublicAppConfig(),
    session: toPublicSessionSummary(session),
  };

  return data(loaderData, {
    headers: createDocumentHeaders({
      hasCookie: request.headers.has("Cookie"),
      isAuthenticated: session.status === "authenticated",
    }),
  });
}

export function headers({ loaderHeaders }: Route.HeadersArgs) {
  const app = getPublicAppConfig();
  return mergeNoindexHeaders(new Headers(loaderHeaders), app.betaNoindex);
}

export function meta({ loaderData }: Route.MetaArgs) {
  const appName = loaderData?.app.appName ?? "qna-platform";
  const tags = [
    { title: appName },
    {
      name: "description",
      content:
        "A creator-owned Q&A foundation for receiving questions and publishing selected answers.",
    },
  ];

  if (loaderData?.app.betaNoindex) {
    tags.push({ name: "robots", content: "noindex,nofollow" });
  }

  return tags;
}

export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <>
      <Outlet />
      <Toaster />
    </>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const title = isRouteErrorResponse(error)
    ? `${String(error.status)} ${error.statusText}`
    : "Something went wrong";
  const message =
    isRouteErrorResponse(error) && typeof error.data === "string"
      ? error.data
      : "The app could not render this route.";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center px-5 py-12">
      <div className="flex flex-col gap-3 rounded-lg border bg-card p-6 text-card-foreground">
        <p className="text-sm font-medium text-muted-foreground">
          qna-platform
        </p>
        <h1 className="font-serif text-3xl font-bold text-primary">{title}</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          {message}
        </p>
      </div>
    </main>
  );
}
