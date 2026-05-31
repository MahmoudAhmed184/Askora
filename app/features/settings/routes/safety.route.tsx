import { data, useActionData } from "react-router";

import type { Route } from "./+types/safety.route";
import { SafetySettingsForm } from "~/features/settings/components/safety-settings-form";
import {
  loadSafetySettings,
  submitSafetySettings,
  type SafetySettingsSubmissionResult,
} from "~/features/settings/safety-settings.server";
import { SettingsShell } from "~/features/settings/components/settings-shell";

interface SafetySettingsActionData {
  safety: SafetySettingsSubmissionResult;
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
    settings: await loadSafetySettings({ session }),
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

export default function SafetySettingsRoute({
  loaderData,
}: Route.ComponentProps) {
  const actionData = useActionData<typeof action>();

  return (
    <SettingsShell
      description="Pause intake, filter phrases, and review sender blocks created from private-question moderation."
      isSuspended={loaderData.isSuspended}
      title="Safety settings"
    >
      <SafetySettingsForm
        disabled={loaderData.isSuspended}
        key={getSafetySettingsFormKey(actionData?.safety)}
        result={actionData?.safety}
        settings={loaderData.settings}
      />
    </SettingsShell>
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
