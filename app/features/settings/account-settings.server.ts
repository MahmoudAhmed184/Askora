import { and, eq } from "drizzle-orm";
import type { ZodError } from "zod";

import { getRuntimeDatabase, type RuntimeDatabase } from "~/db/client.server";
import { authUsers, profiles } from "~/db/schema";
import type { CompletedProfileSessionSummary } from "~/features/auth/auth.server";
import {
  accountSettingsSubmissionSchema,
  accountActionValues,
  type AccountAction,
  type AccountSettingsSubmission,
} from "~/features/settings/settings.schema";
import { parseFormData } from "~/lib/zod-form";

export const ACCOUNT_DELETION_GRACE_DAYS = 14;

export type ProfileDeactivationReason = "user" | "account_deletion" | "admin";

export interface AccountSettingsViewData {
  user: {
    email: string;
    name: string;
  };
  profile: {
    username: string;
    displayName: string;
    isActive: boolean;
    deactivatedAt: string | null;
    deactivationReason: ProfileDeactivationReason | null;
  };
  deletion:
    | {
        status: "none";
      }
    | {
        status: "pending";
        requestedAt: string;
        graceEndsAt: string | null;
        graceEndsDate: string | null;
      }
    | {
        status: "completed";
        anonymizedAt: string;
      };
  deletionGraceDays: number;
}

export interface AccountSettingsFormValues {
  intent: AccountAction | "unknown";
  confirmation: string;
}

export interface AccountSettingsFieldErrors {
  intent?: string;
  confirmation?: string;
}

export type AccountSettingsSubmissionResult =
  | {
      status: "deactivated" | "reactivated" | "deletion_requested" | "deletion_cancelled";
      values: AccountSettingsFormValues;
    }
  | {
      status: "invalid";
      values: AccountSettingsFormValues;
      fieldErrors: AccountSettingsFieldErrors;
      formError: string;
    }
  | {
      status:
        | "not_found"
        | "pending_deletion"
        | "deletion_completed"
        | "no_pending_deletion"
        | "not_user_deactivated"
        | "suspended";
      values: AccountSettingsFormValues;
      formError: string;
    };

export interface StoredAccountSettings {
  userId: string;
  email: string;
  name: string;
  deletedAt: Date | null;
  deletionGraceEndsAt: Date | null;
  deletionAnonymizedAt: Date | null;
  profileId: string;
  profileUserId: string;
  username: string;
  displayName: string;
  isActive: boolean;
  deactivatedAt: Date | null;
  deactivationReason: ProfileDeactivationReason | null;
}

export interface AccountMutationParams {
  userId: string;
  profileId: string;
  now: Date;
}

export interface AccountDeletionRequestParams extends AccountMutationParams {
  deletionGraceEndsAt: Date;
}

export type AccountMutationStoreResult =
  | { status: "updated" }
  | { status: "not_found" }
  | { status: "pending_deletion" }
  | { status: "deletion_completed" }
  | { status: "no_pending_deletion" }
  | { status: "not_user_deactivated" };

export interface AccountSettingsStore {
  findAccountSettings(params: {
    userId: string;
    profileId: string;
  }): Promise<StoredAccountSettings | undefined>;
  deactivateProfile(params: AccountMutationParams): Promise<AccountMutationStoreResult>;
  reactivateProfile(params: AccountMutationParams): Promise<AccountMutationStoreResult>;
  requestAccountDeletion(
    params: AccountDeletionRequestParams,
  ): Promise<AccountMutationStoreResult>;
  cancelAccountDeletion(params: AccountMutationParams): Promise<AccountMutationStoreResult>;
}

interface LoadAccountSettingsOptions {
  session: CompletedProfileSessionSummary;
  store?: AccountSettingsStore;
}

interface SubmitAccountSettingsOptions extends LoadAccountSettingsOptions {
  formData: FormData;
  now?: Date;
}

const accountSettingsNotFoundMessage =
  "Your account settings could not be loaded.";
const invalidAccountActionMessage =
  "Check the account action confirmation and try again.";
const pendingDeletionMessage =
  "This account already has a pending deletion request.";
const completedDeletionMessage =
  "This account deletion has already been finalized.";
const noPendingDeletionMessage =
  "There is no pending deletion request to cancel.";
const reactivationUnavailableMessage =
  "Only profiles deactivated by you can be reactivated from account settings.";
const suspendedReactivationMessage =
  "Profile reactivation is unavailable while this account is suspended.";

export async function loadAccountSettings({
  session,
  store = createDrizzleAccountSettingsStore(),
}: LoadAccountSettingsOptions): Promise<AccountSettingsViewData> {
  const settings = await store.findAccountSettings({
    profileId: session.profile.id,
    userId: session.user.id,
  });

  if (settings === undefined) {
    throw new Error(accountSettingsNotFoundMessage);
  }

  return createAccountSettingsViewData(settings);
}

export async function submitAccountSettings({
  formData,
  now = new Date(),
  session,
  store = createDrizzleAccountSettingsStore(),
}: SubmitAccountSettingsOptions): Promise<AccountSettingsSubmissionResult> {
  const values = getAccountSettingsFormValues(formData);
  const parsed = parseFormData(accountSettingsSubmissionSchema, formData);

  if (!parsed.ok) {
    return {
      status: "invalid",
      values,
      fieldErrors: getAccountSettingsFieldErrors(parsed.error),
      formError: invalidAccountActionMessage,
    };
  }

  if (
    parsed.value.intent === "reactivate" &&
    session.suspensionStatus === "active"
  ) {
    return {
      status: "suspended",
      values,
      formError: suspendedReactivationMessage,
    };
  }

  return handleAccountSettingsSubmission({
    now,
    session,
    store,
    submission: parsed.value,
    values,
  });
}

export function createDrizzleAccountSettingsStore(
  database: RuntimeDatabase = getRuntimeDatabase(),
): AccountSettingsStore {
  return {
    async findAccountSettings({ userId, profileId }) {
      const [settings] = await database
        .select({
          userId: authUsers.id,
          email: authUsers.email,
          name: authUsers.name,
          deletedAt: authUsers.deletedAt,
          deletionGraceEndsAt: authUsers.deletionGraceEndsAt,
          deletionAnonymizedAt: authUsers.deletionAnonymizedAt,
          profileId: profiles.id,
          profileUserId: profiles.userId,
          username: profiles.username,
          displayName: profiles.displayName,
          isActive: profiles.isActive,
          deactivatedAt: profiles.deactivatedAt,
          deactivationReason: profiles.deactivationReason,
        })
        .from(authUsers)
        .innerJoin(profiles, eq(profiles.userId, authUsers.id))
        .where(and(eq(authUsers.id, userId), eq(profiles.id, profileId)))
        .limit(1);

      return settings;
    },
    async deactivateProfile(params) {
      return database.transaction(async (transaction) => {
        const current = await findAccountSettingsForUpdate({ transaction, ...params });

        if (current === undefined) {
          return { status: "not_found" };
        }

        if (current.deletionAnonymizedAt !== null) {
          return { status: "deletion_completed" };
        }

        if (current.deletedAt !== null) {
          return { status: "pending_deletion" };
        }

        await transaction
          .update(profiles)
          .set({
            isActive: false,
            deactivatedAt: params.now,
            deactivationReason: "user",
            updatedAt: params.now,
          })
          .where(and(eq(profiles.id, params.profileId), eq(profiles.userId, params.userId)));

        return { status: "updated" };
      });
    },
    async reactivateProfile(params) {
      return database.transaction(async (transaction) => {
        const current = await findAccountSettingsForUpdate({ transaction, ...params });

        if (current === undefined) {
          return { status: "not_found" };
        }

        if (current.deletionAnonymizedAt !== null) {
          return { status: "deletion_completed" };
        }

        if (current.deletedAt !== null) {
          return { status: "pending_deletion" };
        }

        if (
          current.isActive ||
          current.deactivationReason !== "user" ||
          current.deactivatedAt === null
        ) {
          return { status: "not_user_deactivated" };
        }

        await transaction
          .update(profiles)
          .set({
            isActive: true,
            deactivatedAt: null,
            deactivationReason: null,
            updatedAt: params.now,
          })
          .where(and(eq(profiles.id, params.profileId), eq(profiles.userId, params.userId)));

        return { status: "updated" };
      });
    },
    async requestAccountDeletion(params) {
      return database.transaction(async (transaction) => {
        const current = await findAccountSettingsForUpdate({ transaction, ...params });

        if (current === undefined) {
          return { status: "not_found" };
        }

        if (current.deletionAnonymizedAt !== null) {
          return { status: "deletion_completed" };
        }

        if (current.deletedAt !== null) {
          return { status: "pending_deletion" };
        }

        await transaction
          .update(authUsers)
          .set({
            deletedAt: params.now,
            deletionGraceEndsAt: params.deletionGraceEndsAt,
            deletionAnonymizedAt: null,
            updatedAt: params.now,
          })
          .where(eq(authUsers.id, params.userId));

        await transaction
          .update(profiles)
          .set({
            isActive: false,
            deactivatedAt: params.now,
            deactivationReason: "account_deletion",
            updatedAt: params.now,
          })
          .where(and(eq(profiles.id, params.profileId), eq(profiles.userId, params.userId)));

        return { status: "updated" };
      });
    },
    async cancelAccountDeletion(params) {
      return database.transaction(async (transaction) => {
        const current = await findAccountSettingsForUpdate({ transaction, ...params });

        if (current === undefined) {
          return { status: "not_found" };
        }

        if (current.deletionAnonymizedAt !== null) {
          return { status: "deletion_completed" };
        }

        if (current.deletedAt === null) {
          return { status: "no_pending_deletion" };
        }

        await transaction
          .update(authUsers)
          .set({
            deletedAt: null,
            deletionGraceEndsAt: null,
            deletionAnonymizedAt: null,
            updatedAt: params.now,
          })
          .where(eq(authUsers.id, params.userId));

        await transaction
          .update(profiles)
          .set({
            isActive: false,
            deactivatedAt: params.now,
            deactivationReason: "user",
            updatedAt: params.now,
          })
          .where(and(eq(profiles.id, params.profileId), eq(profiles.userId, params.userId)));

        return { status: "updated" };
      });
    },
  };
}

async function handleAccountSettingsSubmission({
  now,
  session,
  store,
  submission,
  values,
}: {
  now: Date;
  session: CompletedProfileSessionSummary;
  store: AccountSettingsStore;
  submission: AccountSettingsSubmission;
  values: AccountSettingsFormValues;
}): Promise<AccountSettingsSubmissionResult> {
  const params = {
    profileId: session.profile.id,
    userId: session.user.id,
    now,
  };

  if (submission.intent === "deactivate") {
    return toSubmissionResult({
      result: await store.deactivateProfile(params),
      successStatus: "deactivated",
      values,
    });
  }

  if (submission.intent === "reactivate") {
    return toSubmissionResult({
      result: await store.reactivateProfile(params),
      successStatus: "reactivated",
      values,
    });
  }

  if (submission.intent === "request_deletion") {
    return toSubmissionResult({
      result: await store.requestAccountDeletion({
        ...params,
        deletionGraceEndsAt: addDays(now, ACCOUNT_DELETION_GRACE_DAYS),
      }),
      successStatus: "deletion_requested",
      values,
    });
  }

  return toSubmissionResult({
    result: await store.cancelAccountDeletion(params),
    successStatus: "deletion_cancelled",
    values,
  });
}

function toSubmissionResult({
  result,
  successStatus,
  values,
}: {
  result: AccountMutationStoreResult;
  successStatus: Extract<
    AccountSettingsSubmissionResult,
    { status: "deactivated" | "reactivated" | "deletion_requested" | "deletion_cancelled" }
  >["status"];
  values: AccountSettingsFormValues;
}): AccountSettingsSubmissionResult {
  if (result.status === "updated") {
    return {
      status: successStatus,
      values,
    };
  }

  return {
    status: result.status,
    values,
    formError: getStoreResultMessage(result.status),
  };
}

async function findAccountSettingsForUpdate({
  profileId,
  transaction,
  userId,
}: AccountMutationParams & {
  transaction: Parameters<Parameters<RuntimeDatabase["transaction"]>[0]>[0];
}) {
  const [settings] = await transaction
    .select({
      deletedAt: authUsers.deletedAt,
      deletionAnonymizedAt: authUsers.deletionAnonymizedAt,
      isActive: profiles.isActive,
      deactivatedAt: profiles.deactivatedAt,
      deactivationReason: profiles.deactivationReason,
    })
    .from(authUsers)
    .innerJoin(profiles, eq(profiles.userId, authUsers.id))
    .where(and(eq(authUsers.id, userId), eq(profiles.id, profileId)))
    .for("update")
    .limit(1);

  return settings;
}

function createAccountSettingsViewData(
  settings: StoredAccountSettings,
): AccountSettingsViewData {
  return {
    user: {
      email: settings.email,
      name: settings.name,
    },
    profile: {
      username: settings.username,
      displayName: settings.displayName,
      isActive: settings.isActive,
      deactivatedAt: settings.deactivatedAt?.toISOString() ?? null,
      deactivationReason: settings.deactivationReason,
    },
    deletion: getDeletionView(settings),
    deletionGraceDays: ACCOUNT_DELETION_GRACE_DAYS,
  };
}

function getDeletionView(
  settings: Pick<
    StoredAccountSettings,
    "deletedAt" | "deletionGraceEndsAt" | "deletionAnonymizedAt"
  >,
): AccountSettingsViewData["deletion"] {
  if (settings.deletionAnonymizedAt !== null) {
    return {
      status: "completed",
      anonymizedAt: settings.deletionAnonymizedAt.toISOString(),
    };
  }

  if (settings.deletedAt !== null) {
    return {
      status: "pending",
      requestedAt: settings.deletedAt.toISOString(),
      graceEndsAt: settings.deletionGraceEndsAt?.toISOString() ?? null,
      graceEndsDate:
        settings.deletionGraceEndsAt === null
          ? null
          : formatSettingsDate(settings.deletionGraceEndsAt),
    };
  }

  return { status: "none" };
}

function getStoreResultMessage(result: Exclude<AccountMutationStoreResult["status"], "updated">) {
  switch (result) {
    case "not_found":
      return accountSettingsNotFoundMessage;
    case "pending_deletion":
      return pendingDeletionMessage;
    case "deletion_completed":
      return completedDeletionMessage;
    case "no_pending_deletion":
      return noPendingDeletionMessage;
    case "not_user_deactivated":
      return reactivationUnavailableMessage;
  }
}

function getAccountSettingsFormValues(
  formData: FormData,
): AccountSettingsFormValues {
  const intent = getFormText(formData, "intent");

  return {
    intent: isAccountAction(intent) ? intent : "unknown",
    confirmation: getFormText(formData, "confirmation"),
  };
}

function getAccountSettingsFieldErrors(
  error: ZodError,
): AccountSettingsFieldErrors {
  const fieldErrors: AccountSettingsFieldErrors = {};

  for (const issue of error.issues) {
    const field = issue.path[0];

    if (field === "intent" && fieldErrors.intent === undefined) {
      fieldErrors.intent = issue.message;
    }

    if (field === "confirmation" && fieldErrors.confirmation === undefined) {
      fieldErrors.confirmation = issue.message;
    }
  }

  return fieldErrors;
}

function isAccountAction(value: string): value is AccountAction {
  return accountActionValues.includes(value as AccountAction);
}

function getFormText(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function formatSettingsDate(date: Date) {
  return date.toISOString().slice(0, 10);
}
