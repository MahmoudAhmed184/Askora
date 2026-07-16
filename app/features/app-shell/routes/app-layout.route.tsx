import {
  isRouteErrorResponse,
  Link,
  Outlet,
  type ShouldRevalidateFunctionArgs,
} from "react-router";

import { AppShell } from "~/components/layout/app-shell/app-shell";
import {
  requireCompletedProfileSessionAllowingInactiveFromContext,
  requireCompletedProfileSessionFromContext,
} from "~/features/auth/services/auth.service.server";
import { loadAppShellData } from "~/features/app-shell/services/app-shell.service.server";

import type { Route } from "./+types/app-layout.route";

export async function loader({ context, request }: Route.LoaderArgs) {
  const session = isAccountSettingsPath(request.url)
    ? requireCompletedProfileSessionAllowingInactiveFromContext(context)
    : requireCompletedProfileSessionFromContext(context);

  if (session instanceof Response) {
    return session;
  }

  return {
    shell: await loadAppShellData({ session }),
  };
}

function isAccountSettingsPath(url: string) {
  return new URL(url).pathname === "/settings/account";
}

export function shouldRevalidate({
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  return defaultShouldRevalidate;
}

export default function AppLayoutRoute({
  loaderData,
}: Route.ComponentProps) {
  return (
    <AppShell shell={loaderData.shell}>
      <Outlet context={loaderData.shell} />
    </AppShell>
  );
}

export function ErrorBoundary({
  error,
  loaderData,
}: Route.ErrorBoundaryProps) {
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

  return loaderData === undefined ? (
    <main className="mx-auto flex min-h-screen w-full items-center px-5 py-12">
      {content}
    </main>
  ) : (
    <AppShell shell={loaderData.shell}>{content}</AppShell>
  );
}
