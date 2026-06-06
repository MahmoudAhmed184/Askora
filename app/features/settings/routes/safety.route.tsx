import { data, useActionData, useOutletContext } from "react-router";

import type { Route } from "./+types/safety.route";
import { requireCompletedProfileSessionFromContext } from "~/features/auth/auth.server";
import { SafetySettingsForm } from "~/features/settings/components/safety-settings-form";
import {
  submitSafetySettings,
  type SafetySettingsSubmissionResult,
} from "~/features/settings/safety-settings.server";
import type { SettingsRouteContext } from "~/features/settings/settings-route-context";

interface SafetySettingsActionData {
  safety: SafetySettingsSubmissionResult;
}

export async function action({ context, request }: Route.ActionArgs) {
  const session = requireCompletedProfileSessionFromContext(context);

  if (session instanceof Response) {
    return session;
  }

  const result = await submitSafetySettings({
    formData: await request.formData(),
    session,
  });

  return data<SafetySettingsActionData>(
    { safety: result },
    { status: getSafetySettingsResponseStatus(result) },
  );
}

export function meta() {
  return [{ title: "Safety settings | qna-platform" }];
}

export default function SafetySettingsRoute() {
  const actionData = useActionData<typeof action>();
  const { isSuspended, settings } = useOutletContext<SettingsRouteContext>();

  return (
    <SafetySettingsForm
      disabled={isSuspended}
      key={getSafetySettingsFormKey(actionData?.safety)}
      result={actionData?.safety}
      settings={settings.safety}
    />
  );
}

function getSafetySettingsResponseStatus(
  result: SafetySettingsSubmissionResult,
) {
  switch (result.status) {
    case "safety_updated":
    case "muted_phrase_added":
    case "muted_phrase_duplicate":
    case "muted_phrase_removed":
    case "sender_unblocked":
      return 200;
    case "suspended":
      return 403;
    case "not_found":
      return 404;
    case "muted_phrase_limit":
    case "invalid":
      return 400;
  }
}

function getSafetySettingsFormKey(
  result: SafetySettingsSubmissionResult | undefined,
) {
  if (result === undefined) {
    return "loaded";
  }

  return [
    "action",
    result.status,
    result.values.intent,
    String(result.values.acceptingQuestions),
    result.values.phrase,
    result.values.mutedPhraseId,
    result.values.blockId,
  ].join(":");
}
