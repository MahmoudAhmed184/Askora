import { data, useActionData, useOutletContext } from "react-router";

import type { Route } from "./+types/profile.route";
import { requireCompletedProfileSessionFromContext } from "~/features/auth/services/auth.service.server";
import { ProfileSettingsForm } from "~/features/settings/components/profile-settings-form";
import {
  submitProfileSettings,
  type ProfileSettingsSubmissionResult,
} from "~/features/settings/services/profile-settings.service.server";
import type { SettingsRouteContext } from "~/features/settings/types/settings.types";

interface ProfileSettingsActionData {
  profile: ProfileSettingsSubmissionResult;
}

export async function action({ context, request }: Route.ActionArgs) {
  const session = requireCompletedProfileSessionFromContext(context);

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

export default function ProfileSettingsRoute() {
  const actionData = useActionData<typeof action>();
  const { isSuspended, settings } = useOutletContext<SettingsRouteContext>();

  return (
    <ProfileSettingsForm
      disabled={isSuspended}
      key={getProfileSettingsFormKey(actionData?.profile)}
      result={actionData?.profile}
      settings={settings.profile}
    />
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
