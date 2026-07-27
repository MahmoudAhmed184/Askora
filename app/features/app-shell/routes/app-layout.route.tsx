import {
  isRouteErrorResponse,
  Link,
  Outlet,
  type ShouldRevalidateFunctionArgs,
  useRouteLoaderData,
} from "react-router";

import { AppShell } from "~/components/layout/app-shell/app-shell";
import {
  requireCompletedProfileSessionAllowingInactiveFromContext,
  requireCompletedProfileSessionFromContext,
} from "~/features/auth/services/auth.service.server";
import { appShellRouteHandle } from "~/features/app-shell/app-shell-route";
import type { loader as rootLoader } from "~/root";

import type { Route } from "./+types/app-layout.route";

export function loader({ context, request }: Route.LoaderArgs) {
  const session = isAccountSettingsPath(request.url)
    ? requireCompletedProfileSessionAllowingInactiveFromContext(context)
    : requireCompletedProfileSessionFromContext(context);

  if (session instanceof Response) {
    return session;
  }

  return null;
}

export const handle = appShellRouteHandle;

function isAccountSettingsPath(url: string) {
  return new URL(url).pathname === "/settings/account";
}

export function shouldRevalidate({
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  return defaultShouldRevalidate;
}

export default function AppLayoutRoute() {
  const shell = useRootShell();

  return (
    <AppShell>
      <Outlet context={shell} />
    </AppShell>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const rootData = useRouteLoaderData<typeof rootLoader>("root");
  const title = isRouteErrorResponse(error)
    ? `${String(error.status)} ${error.statusText}`
    : "Something went wrong";
  const message =
    isRouteErrorResponse(error) && typeof error.data === "string"
      ? error.data
      : "This page could not be loaded. Your navigation is still available.";
  const content = (
    <section
      aria-labelledby="app-route-error-title"
      className="mx-auto flex w-full max-w-2xl flex-col gap-4 rounded-3xl border bg-card p-6 text-card-foreground shadow-[var(--shadow-card)]"
    >
      <h1
        className="font-serif text-3xl font-bold text-primary"
        id="app-route-error-title"
      >
        {title}
      </h1>
      <p className="text-sm leading-6 text-muted-foreground">{message}</p>
      <Link
        className="w-fit rounded-full border bg-background px-4 py-2 text-sm font-semibold text-foreground"
        to="/feed"
      >
        Return to feed
      </Link>
    </section>
  );

  return rootData?.shell === undefined ? (
    <main className="mx-auto flex min-h-screen w-full items-center px-5 py-12">
      {content}
    </main>
  ) : (
    <AppShell>{content}</AppShell>
  );
}

function useRootShell() {
  const rootData = useRouteLoaderData<typeof rootLoader>("root");

  if (rootData?.shell === undefined) {
    throw new Error("Authenticated app routes require app shell data.");
  }

  return rootData.shell;
}
