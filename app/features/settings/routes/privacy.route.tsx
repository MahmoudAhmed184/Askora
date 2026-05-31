import { data, useActionData } from "react-router";

import type { Route } from "./+types/privacy.route";
import { PrivacySettingsForm } from "~/features/settings/components/privacy-settings-form";
import { SettingsShell } from "~/features/settings/components/settings-shell";
import {
  loadPrivacySettings,
  submitPrivacySettings,
  type PrivacySettingsSubmissionResult,
} from "~/features/settings/privacy-settings.server";

interface PrivacySettingsActionData {
  privacy: PrivacySettingsSubmissionResult;
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
    settings: await loadPrivacySettings({ session }),
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

  const result = await submitPrivacySettings({
    formData: await request.formData(),
    session,
  });

  return data<PrivacySettingsActionData>(
    { privacy: result },
    { status: getPrivacySettingsResponseStatus(result) },
  );
}

export function meta() {
  return [{ title: "Privacy settings | qna-platform" }];
}

export default function PrivacySettingsRoute({
  loaderData,
}: Route.ComponentProps) {
  const actionData = useActionData<typeof action>();

  return (
    <SettingsShell
      description="Control question intake, follow-up permissions, and public count visibility."
      isSuspended={loaderData.isSuspended}
      title="Privacy settings"
    >
      <PrivacySettingsForm
        disabled={loaderData.isSuspended}
        key={getPrivacySettingsFormKey(actionData?.privacy)}
        result={actionData?.privacy}
        settings={loaderData.settings}
      />
    </SettingsShell>
  );
}

function getPrivacySettingsResponseStatus(
  result: PrivacySettingsSubmissionResult,
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

  return 400;
}

function getPrivacySettingsFormKey(
  result: PrivacySettingsSubmissionResult | undefined,
) {
  if (result === undefined) {
    return "loaded";
  }

  return [
    "action",
    result.status,
    String(result.values.anonymousQuestionsEnabled),
    result.values.askPermission,
    result.values.followUpPermissionDefault,
    String(result.values.showFollowerCounts),
    String(result.values.showLikeCounts),
  ].join(":");
}
