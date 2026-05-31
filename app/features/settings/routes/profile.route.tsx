import { data, useActionData } from "react-router";

import type { Route } from "./+types/profile.route";
import { ProfileSettingsForm } from "~/features/settings/components/profile-settings-form";
import { SettingsShell } from "~/features/settings/components/settings-shell";
import {
  loadProfileSettings,
  submitProfileSettings,
  type ProfileSettingsSubmissionResult,
} from "~/features/settings/profile-settings.server";

interface ProfileSettingsActionData {
  profile: ProfileSettingsSubmissionResult;
}

export async function loader({ request }: Route.LoaderArgs) {
  const { isSessionSuspended, requireCompletedProfileSession } = await import(
    "~/features/auth/auth.server"
  );
  const session = await requireCompletedProfileSession(request);

  if (session instanceof Response) {
    return session;
  }

  return {
    settings: await loadProfileSettings({ session }),
    isSuspended: isSessionSuspended(session),
  };
}

export async function action({ request }: Route.ActionArgs) {
  const { requireCompletedProfileSession } = await import(
    "~/features/auth/auth.server"
  );
  const session = await requireCompletedProfileSession(request);

  if (session instanceof Response) {
    return session;
  }

  const result = await submitProfileSettings({
    formData: await request.formData(),
    session,
  });

  return data<ProfileSettingsActionData>(
    { profile: result },
    { status: getProfileSettingsResponseStatus(result) },
  );
}

export function meta() {
  return [{ title: "Profile settings | qna-platform" }];
}

export default function ProfileSettingsRoute({
  loaderData,
}: Route.ComponentProps) {
  const actionData = useActionData<typeof action>();

  return (
    <SettingsShell
      description="Manage your public identity, avatar source, and reserved username."
      isSuspended={loaderData.isSuspended}
      title="Profile settings"
    >
      <ProfileSettingsForm
        disabled={loaderData.isSuspended}
        key={getProfileSettingsFormKey(actionData?.profile)}
        result={actionData?.profile}
        settings={loaderData.settings}
      />
    </SettingsShell>
  );
}

function getProfileSettingsResponseStatus(
  result: ProfileSettingsSubmissionResult,
) {
  if (result.status === "updated") {
    return 200;
  }

  if (result.status === "suspended") {
    return 403;
  }

  if (result.status === "not_found") {
    return 404;
  }

  if (
    result.status === "username_taken" ||
    result.status === "cooldown" ||
    result.status === "stale"
  ) {
    return 409;
  }

  return 400;
}

function getProfileSettingsFormKey(
  result: ProfileSettingsSubmissionResult | undefined,
) {
  if (result === undefined) {
    return "loaded";
  }

  return [
    "action",
    result.status,
    result.values.username,
    result.values.displayName,
    result.values.bio,
    result.values.avatarSource,
  ].join(":");
}
