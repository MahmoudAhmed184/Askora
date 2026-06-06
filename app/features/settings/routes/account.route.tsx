import { data, useActionData, useOutletContext } from "react-router";

import type { Route } from "./+types/account.route";
import { requireCompletedProfileSessionFromContext } from "~/features/auth/auth.server";
import { AccountSettingsForm } from "~/features/settings/components/account-settings-form";
import {
  submitAccountSettings,
  type AccountSettingsSubmissionResult,
} from "~/features/settings/account-settings.server";
import type { SettingsRouteContext } from "~/features/settings/settings-route-context";

interface AccountSettingsActionData {
  account: AccountSettingsSubmissionResult;
}

export async function action({ context, request }: Route.ActionArgs) {
  const session = requireCompletedProfileSessionFromContext(context);

  if (session instanceof Response) {
    return session;
  }

  const result = await submitAccountSettings({
    formData: await request.formData(),
    session,
  });

  return data<AccountSettingsActionData>(
    { account: result },
    { status: getAccountSettingsResponseStatus(result) },
  );
}

export function meta() {
  return [{ title: "Account settings | qna-platform" }];
}

export default function AccountSettingsRoute() {
  const actionData = useActionData<typeof action>();
  const { isSuspended, settings } = useOutletContext<SettingsRouteContext>();

  return (
    <AccountSettingsForm
      isSuspended={isSuspended}
      key={getAccountSettingsFormKey(actionData?.account)}
      result={actionData?.account}
      settings={settings.account}
    />
  );
}

function getAccountSettingsResponseStatus(
  result: AccountSettingsSubmissionResult,
) {
  if (
    result.status === "deactivated" ||
    result.status === "reactivated" ||
    result.status === "deletion_requested" ||
    result.status === "deletion_cancelled"
  ) {
    return 200;
  }

  if (result.status === "suspended") {
    return 403;
  }

  if (result.status === "not_found") {
    return 404;
  }

  if (
    result.status === "pending_deletion" ||
    result.status === "deletion_completed" ||
    result.status === "no_pending_deletion" ||
    result.status === "not_user_deactivated"
  ) {
    return 409;
  }

  return 400;
}

function getAccountSettingsFormKey(
  result: AccountSettingsSubmissionResult | undefined,
) {
  if (result === undefined) {
    return "loaded";
  }

  return [
    "action",
    result.status,
    result.values.intent,
    result.values.confirmation,
  ].join(":");
}
