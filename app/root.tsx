import type { ReactNode } from "react";
import {
  data,
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  type ShouldRevalidateFunctionArgs,
  useMatches,
  useRouteError,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";

import { BrandLogo } from "~/components/shared/brand-logo/brand-logo";
import { AppNavigation } from "~/components/layout/app-shell/app-shell";
import { ThemeWatcher } from "~/components/shared/theme-watcher/theme-watcher";
import { Toaster } from "~/components/ui/sonner/sonner";
import { usesAppShell } from "~/features/app-shell/app-shell-route";
import { loadAppShellData } from "~/features/app-shell/services/app-shell.service.server";
import { AnswerEditorModalHost } from "~/features/answers/components/answer-editor-modal-host";
import { loadAnswerModalData } from "~/features/answers/services/answer-modal.service.server";
import {
  hasAnswerModalSearchParamChange,
  getAnswerModalParams,
} from "~/features/answers/answer-modal";
import { currentSessionContext } from "~/features/auth/auth.context";
import {
  getCurrentSessionSummary,
  getCurrentSessionSummaryFromContext,
  toPublicSessionSummary,
  type PublicSessionSummary,
} from "~/features/auth/services/auth.service.server";
import { ThreadModalHost } from "~/features/threads/components/thread-modal-host";
import { loadThreadModalData } from "~/features/threads/services/thread-modal.service.server";
import {
  hasThreadModalSearchParamChange,
  type ThreadModalData,
} from "~/features/threads/thread-modal";
import { getThreadModalParams } from "~/features/threads/thread-modal";
import { getPublicAppConfig } from "~/lib/config.server";
import type { PublicAppConfig } from "~/lib/config.types";
import type { AppShellData } from "~/types/app-shell-data";
import {
  createDocumentHeaders,
  mergeNoindexHeaders,
} from "~/lib/response.server";

export interface RootLoaderData {
  app: PublicAppConfig;
  shell: AppShellData | undefined;
  session: PublicSessionSummary;
  threadModal: ThreadModalData | undefined;
  answerModal: Awaited<ReturnType<typeof loadAnswerModalData>>;
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

export async function loader({ context, request }: Route.LoaderArgs) {
  const session = getCurrentSessionSummaryFromContext(context);
  const searchParams = new URL(request.url).searchParams;
  const answerParams = getAnswerModalParams(searchParams);
  const threadParams = getThreadModalParams(searchParams);
  const [shell, threadModal, answerModal] = await Promise.all([
    session.status === "authenticated" && session.profileStatus === "complete"
      ? loadAppShellData({ session })
      : Promise.resolve(undefined),
    answerParams === undefined && threadParams !== undefined
      ? loadThreadModalData({ request, session })
      : Promise.resolve(undefined),
    threadParams === undefined && answerParams !== undefined
      ? loadAnswerModalData({ request, session })
      : Promise.resolve(undefined),
  ]);

  const loaderData: RootLoaderData = {
    app: getPublicAppConfig(),
    shell,
    session: toPublicSessionSummary(session),
    threadModal,
    answerModal,
  };

  return data(loaderData, {
    headers: createDocumentHeaders({
      hasCookie: request.headers.has("Cookie"),
      isAuthenticated: session.status === "authenticated",
    }),
  });
}

export function shouldRevalidate({
  currentUrl,
  defaultShouldRevalidate,
  nextUrl,
}: ShouldRevalidateFunctionArgs) {
  if (
    hasThreadModalSearchParamChange(currentUrl, nextUrl) ||
    hasAnswerModalSearchParamChange(currentUrl, nextUrl)
  ) {
    return true;
  }

  return defaultShouldRevalidate;
}

export function headers({ loaderHeaders }: Route.HeadersArgs) {
  const app = getPublicAppConfig();
  return mergeNoindexHeaders(new Headers(loaderHeaders), app.betaNoindex);
}

export function meta({ loaderData }: Route.MetaArgs) {
  const appName = loaderData?.app.appName ?? "Askora";
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

const themeBootstrapScript = `(function () {
  try {
    var stored = localStorage.getItem("theme");
    var dark =
      stored === "dark" ||
      (stored !== "light" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
  } catch (error) {}
})();`;

export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
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

export default function App({ loaderData }: Route.ComponentProps) {
  const matches = useMatches();
  const shell = matches.some((match) => usesAppShell(match.handle))
    ? loaderData.shell
    : undefined;

  return (
    <>
      <Outlet />
      <AppNavigation shell={shell} />
      <ThreadModalHost modal={loaderData.threadModal} />
      <AnswerEditorModalHost modal={loaderData.answerModal} />
      <ThemeWatcher />
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
        <BrandLogo className="h-9" />
        <h1 className="font-serif text-3xl font-bold text-primary">{title}</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          {message}
        </p>
      </div>
    </main>
  );
}
