import { Outlet, type ShouldRevalidateFunctionArgs } from "react-router";

import {
  isSessionSuspended,
  requireCompletedProfileSessionAllowingInactiveFromContext,
} from "~/features/auth/services/auth.service.server";
import { loadAccountSettings } from "~/features/settings/services/account-settings.service.server";
import { SettingsShell } from "~/features/settings/components/settings-shell";
import { loadPrivacySettings } from "~/features/settings/services/privacy-settings.service.server";
import { loadProfileSettings } from "~/features/settings/services/profile-settings.service.server";
import { loadSafetySettings } from "~/features/settings/services/safety-settings.service.server";
import { loadQuestionGenerationSettings } from "~/features/question-generation/question-generation-settings.service.server";
import type { SettingsRouteContext } from "~/features/settings/types/settings.types";

import type { Route } from "./+types/settings-layout.route";

export async function loader({ context }: Route.LoaderArgs) {
  const session = requireCompletedProfileSessionAllowingInactiveFromContext(context);

  if (session instanceof Response) {
    return session;
  }

  const [profile, privacy, safety, account, questionGeneration] = await Promise.all([
    loadProfileSettings({ session }),
    loadPrivacySettings({ session }),
    loadSafetySettings({ session }),
    loadAccountSettings({ session }),
    loadQuestionGenerationSettings({ session }),
  ]);

  return {
    isSuspended: isSessionSuspended(session),
    settings: {
      account,
      privacy,
      profile,
      safety,
      questionGeneration,
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

  return getPathname(formAction).startsWith("/settings/");
}

function getPathname(value: string) {
  return value.startsWith("http")
    ? new URL(value).pathname
    : (value.split("?")[0] ?? "");
}
