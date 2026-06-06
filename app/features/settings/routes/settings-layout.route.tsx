import { Outlet, type ShouldRevalidateFunctionArgs } from "react-router";

import {
  isSessionSuspended,
  requireCompletedProfileSessionFromContext,
} from "~/features/auth/auth.server";
import { loadAccountSettings } from "~/features/settings/account-settings.server";
import { SettingsShell } from "~/features/settings/components/settings-shell";
import { loadPrivacySettings } from "~/features/settings/privacy-settings.server";
import { loadProfileSettings } from "~/features/settings/profile-settings.server";
import { loadSafetySettings } from "~/features/settings/safety-settings.server";
import type { SettingsRouteContext } from "~/features/settings/settings-route-context";

import type { Route } from "./+types/settings-layout.route";

export async function loader({ context }: Route.LoaderArgs) {
  const session = requireCompletedProfileSessionFromContext(context);

  if (session instanceof Response) {
    return session;
  }

  const [profile, privacy, safety, account] = await Promise.all([
    loadProfileSettings({ session }),
    loadPrivacySettings({ session }),
    loadSafetySettings({ session }),
    loadAccountSettings({ session }),
  ]);

  return {
    isSuspended: isSessionSuspended(session),
    settings: {
      account,
      privacy,
      profile,
      safety,
    },
  } satisfies SettingsRouteContext;
}

export function shouldRevalidate({
  defaultShouldRevalidate,
  formAction,
  formMethod,
}: ShouldRevalidateFunctionArgs) {
  if (formMethod === undefined) {
    return false;
  }

  if (formMethod.toUpperCase() === "GET") {
    return defaultShouldRevalidate;
  }

  return isSettingsMutation(formAction);
}

export default function SettingsLayoutRoute({
  loaderData,
}: Route.ComponentProps) {
  return (
    <SettingsShell isSuspended={loaderData.isSuspended}>
      <Outlet context={loaderData satisfies SettingsRouteContext} />
    </SettingsShell>
  );
}

function isSettingsMutation(formAction: string | undefined) {
  if (formAction === undefined) {
    return false;
  }

  return getPathname(formAction).startsWith("/dashboard/settings/");
}

function getPathname(value: string) {
  return value.startsWith("http")
    ? new URL(value).pathname
    : (value.split("?")[0] ?? "");
}
