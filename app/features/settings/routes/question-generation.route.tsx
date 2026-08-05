import { data, useActionData, useOutletContext } from "react-router";

import type { Route } from "./+types/question-generation.route";
import { requireCompletedProfileSessionFromContext } from "~/features/auth/services/auth.service.server";
import { QuestionGenerationSettingsForm } from "~/features/settings/components/question-generation-settings-form";
import {
  submitQuestionGenerationSettings,
  type QuestionGenerationSettingsSubmissionResult,
} from "~/features/question-generation/question-generation-settings.service.server";
import type { SettingsRouteContext } from "~/features/settings/types/settings.types";

interface QuestionGenerationSettingsActionData {
  questionGeneration: QuestionGenerationSettingsSubmissionResult;
}

export async function action(
  { context, request }: Route.ActionArgs,
  submitSettings = submitQuestionGenerationSettings,
) {
  const session = requireCompletedProfileSessionFromContext(context);

  if (session instanceof Response) {
    return session;
  }

  const result = await submitSettings({
    formData: await request.formData(),
    session,
  });

  return data<QuestionGenerationSettingsActionData>(
    { questionGeneration: result },
    { status: getQuestionGenerationSettingsResponseStatus(result) },
  );
}

export function meta() {
  return [{ title: "Question generation settings | Askora" }];
}

export default function QuestionGenerationSettingsRoute() {
  const actionData = useActionData<typeof action>();
  const { isSuspended, settings } = useOutletContext<SettingsRouteContext>();

  return (
    <QuestionGenerationSettingsForm
      disabled={isSuspended}
      key={getQuestionGenerationFormKey(actionData?.questionGeneration)}
      result={actionData?.questionGeneration}
      settings={settings.questionGeneration}
    />
  );
}

function getQuestionGenerationSettingsResponseStatus(
  result: QuestionGenerationSettingsSubmissionResult,
) {
  if (
    result.status === "credential_connected" ||
    result.status === "credential_replaced" ||
    result.status === "credential_disconnected" ||
    result.status === "preferences_saved" ||
    result.status === "disclosure_acknowledged"
  ) {
    return 200;
  }

  if (result.status === "suspended") {
    return 403;
  }

  if (result.status === "rate_limited") {
    return 429;
  }

  if (
    result.status === "credential_invalid" ||
    result.status === "provider_unavailable"
  ) {
    return 422;
  }

  return 400;
}

function getQuestionGenerationFormKey(
  result: QuestionGenerationSettingsSubmissionResult | undefined,
) {
  if (result === undefined) {
    return "loaded";
  }

  return [
    result.status,
    result.values.modelPreference,
    result.values.questionInterests.join(":"),
  ].join(":");
}
