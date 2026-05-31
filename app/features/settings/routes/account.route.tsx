import { data, useActionData } from "react-router";

import type { Route } from "./+types/account.route";
import { AccountSettingsForm } from "~/features/settings/components/account-settings-form";
import { SettingsShell } from "~/features/settings/components/settings-shell";
import {
  loadAccountSettings,
  submitAccountSettings,
  type AccountSettingsSubmissionResult,
} from "~/features/settings/account-settings.server";

interface AccountSettingsActionData {
  account: AccountSettingsSubmissionResult;
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
    settings: await loadAccountSettings({ session }),
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

export default function AccountSettingsRoute({
  loaderData,
}: Route.ComponentProps) {
  const actionData = useActionData<typeof action>();

  return (
    <SettingsShell
      description="Manage profile availability and account deletion requests."
      isSuspended={loaderData.isSuspended}
      title="Account settings"
    >
      <AccountSettingsForm
        isSuspended={loaderData.isSuspended}
        key={getAccountSettingsFormKey(actionData?.account)}
        result={actionData?.account}
        settings={loaderData.settings}
      />
    </SettingsShell>
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
