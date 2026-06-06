import { Outlet, type ShouldRevalidateFunctionArgs } from "react-router";

import { DashboardShell } from "~/components/app/dashboard-shell";
import { requireCompletedProfileSessionFromContext } from "~/features/auth/auth.server";
import { loadAppShellData } from "~/features/dashboard/app-shell.server";

import type { Route } from "./+types/dashboard-layout.route";

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

export default function DashboardLayoutRoute({
  loaderData,
}: Route.ComponentProps) {
  return (
    <DashboardShell shell={loaderData.shell}>
      <Outlet context={loaderData.shell} />
    </DashboardShell>
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
    pathname === "/dashboard/notifications" ||
    pathname === "/dashboard/settings/profile" ||
    pathname === "/dashboard/settings/account"
  );
}

function getPathname(value: string) {
  return value.startsWith("http")
    ? new URL(value).pathname
    : (value.split("?")[0] ?? "");
}
