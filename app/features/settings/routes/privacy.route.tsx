import { data, useActionData, useOutletContext } from "react-router";

import type { Route } from "./+types/privacy.route";
import { requireCompletedProfileSessionFromContext } from "~/features/auth/services/auth.service.server";
import { PrivacySettingsForm } from "~/features/settings/components/privacy-settings-form";
import {
  submitPrivacySettings,
  type PrivacySettingsSubmissionResult,
} from "~/features/settings/services/privacy-settings.service.server";
import type { SettingsRouteContext } from "~/features/settings/types/settings.types";

interface PrivacySettingsActionData {
  privacy: PrivacySettingsSubmissionResult;
}

export async function action({ context, request }: Route.ActionArgs) {
  const session = requireCompletedProfileSessionFromContext(context);

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
  return [{ title: "Privacy settings | Askora" }];
}

export default function PrivacySettingsRoute() {
  const actionData = useActionData<typeof action>();
  const { isSuspended, settings } = useOutletContext<SettingsRouteContext>();

  return (
    <PrivacySettingsForm
      disabled={isSuspended}
      key={getPrivacySettingsFormKey(actionData?.privacy)}
      result={actionData?.privacy}
      settings={settings.privacy}
    />
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
