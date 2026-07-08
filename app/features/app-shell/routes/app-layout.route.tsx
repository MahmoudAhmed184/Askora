import { Outlet, type ShouldRevalidateFunctionArgs } from "react-router";

import { AppShell } from "~/components/layout/app-shell/app-shell";
import { requireCompletedProfileSessionFromContext } from "~/features/auth/services/auth.service.server";
import { loadAppShellData } from "~/features/app-shell/services/app-shell.service.server";

import type { Route } from "./+types/app-layout.route";

export async function loader({ context }: Route.LoaderArgs) {
  const session = requireCompletedProfileSessionFromContext(context);

  if (session instanceof Response) {
    return session;
  }

  return {
    shell: await loadAppShellData({ session }),
  };
}

export function shouldRevalidate({
  defaultShouldRevalidate,
  formAction,
  formMethod,
}: ShouldRevalidateFunctionArgs) {
  if (formMethod === undefined) {
    return false;
  }

  if (!isMutationMethod(formMethod)) {
    return defaultShouldRevalidate;
  }

  return isShellMutation(formAction);
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

function isMutationMethod(method: string) {
  return method.toUpperCase() !== "GET";
}

function isShellMutation(formAction: string | undefined) {
  if (formAction === undefined) {
    return false;
  }

  const pathname = getPathname(formAction);

  return (
    pathname === "/notifications" ||
    pathname === "/settings/profile" ||
    pathname === "/settings/account"
  );
}

function getPathname(value: string) {
  return value.startsWith("http")
    ? new URL(value).pathname
    : (value.split("?")[0] ?? "");
}
