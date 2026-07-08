import { and, eq } from "drizzle-orm";
import type { ZodError } from "zod";

import { getRuntimeDatabase, type RuntimeDatabase } from "~/db/client.server";
import { profiles } from "~/db/schema";
import type {
  CompletedProfileSessionSummary
} from "~/features/auth/services/auth.service.server";;
import {
  askPermissionValues,
  followUpPermissionValues,
  privacySettingsSubmissionSchema,
  type AskPermission,
  type FollowUpPermission,
  type PrivacySettingsSubmission,
} from "~/features/settings/validations/settings.validations";
import { parseFormData } from "~/lib/zod-form";

export interface PrivacySettingsFormValues {
  anonymousQuestionsEnabled: boolean;
  askPermission: AskPermission;
  followUpPermissionDefault: FollowUpPermission;
  showFollowerCounts: boolean;
  showLikeCounts: boolean;
}

export interface PrivacySettingsFieldErrors {
  anonymousQuestionsEnabled?: string;
  askPermission?: string;
  followUpPermissionDefault?: string;
  showFollowerCounts?: string;
  showLikeCounts?: string;
}

export type PrivacySettingsSubmissionResult =
  | {
      status: "updated";
      values: PrivacySettingsFormValues;
    }
  | {
      status: "invalid";
      values: PrivacySettingsFormValues;
      fieldErrors: PrivacySettingsFieldErrors;
      formError?: string;
    }
  | {
      status: "suspended";
      values: PrivacySettingsFormValues;
      formError: string;
    }
  | {
      status: "not_found";
      values: PrivacySettingsFormValues;
      formError: string;
    };

export interface StoredPrivacySettings {
  anonymousQuestionsEnabled: boolean;
  askPermission: AskPermission;
  followUpPermissionDefault: FollowUpPermission;
  showFollowerCounts: boolean;
  showLikeCounts: boolean;
}

export interface PrivacySettingsUpdate extends PrivacySettingsFormValues {
  profileId: string;
  userId: string;
  updatedAt: Date;
}

export interface PrivacySettingsStore {
  findPrivacySettings(params: {
    profileId: string;
    userId: string;
  }): Promise<StoredPrivacySettings | undefined>;
  updatePrivacySettings(update: PrivacySettingsUpdate): Promise<void>;
}

interface LoadPrivacySettingsOptions {
  session: CompletedProfileSessionSummary;
  store?: PrivacySettingsStore;
}

interface SubmitPrivacySettingsOptions extends LoadPrivacySettingsOptions {
  formData: FormData;
  now?: Date;
}

const suspendedPrivacySettingsMessage =
  "Privacy settings are unavailable while this account is suspended.";
const privacySettingsNotFoundMessage =
  "Your privacy settings could not be loaded.";

export async function loadPrivacySettings({
  session,
  store = createDrizzlePrivacySettingsStore(),
}: LoadPrivacySettingsOptions): Promise<PrivacySettingsFormValues> {
  const settings = await store.findPrivacySettings({
    profileId: session.profile.id,
    userId: session.user.id,
  });

  if (settings === undefined) {
    throw new Error(privacySettingsNotFoundMessage);
  }

  return settings;
}

export async function submitPrivacySettings({
  formData,
  session,
  store = createDrizzlePrivacySettingsStore(),
  now = new Date(),
}: SubmitPrivacySettingsOptions): Promise<PrivacySettingsSubmissionResult> {
  const values = getPrivacySettingsFormValues(formData);

  if (session.suspensionStatus === "active") {
    return {
      status: "suspended",
      values,
      formError: suspendedPrivacySettingsMessage,
    };
  }

  const parsed = parseFormData(privacySettingsSubmissionSchema, formData);

  if (!parsed.ok) {
    return {
      status: "invalid",
      values,
      fieldErrors: getPrivacySettingsFieldErrors(parsed.error),
    };
  }

  const currentSettings = await store.findPrivacySettings({
    profileId: session.profile.id,
    userId: session.user.id,
  });

  if (currentSettings === undefined) {
    return {
      status: "not_found",
      values: getPrivacySettingsValues(parsed.value),
      formError: privacySettingsNotFoundMessage,
    };
  }

  const normalizedValues = getPrivacySettingsValues(parsed.value);

  await store.updatePrivacySettings({
    profileId: session.profile.id,
    userId: session.user.id,
    updatedAt: now,
    ...normalizedValues,
  });

  return {
    status: "updated",
    values: normalizedValues,
  };
}

export function createDrizzlePrivacySettingsStore(
  database: RuntimeDatabase = getRuntimeDatabase(),
): PrivacySettingsStore {
  return {
    async findPrivacySettings({ profileId, userId }) {
      const [settings] = await database
        .select({
          anonymousQuestionsEnabled: profiles.anonymousQuestionsEnabled,
          askPermission: profiles.askPermission,
          followUpPermissionDefault: profiles.followUpPermissionDefault,
          showFollowerCounts: profiles.showFollowerCounts,
          showLikeCounts: profiles.showLikeCounts,
        })
        .from(profiles)
        .where(and(eq(profiles.id, profileId), eq(profiles.userId, userId)))
        .limit(1);

      return settings;
    },
    async updatePrivacySettings(update) {
      await database
        .update(profiles)
        .set({
          anonymousQuestionsEnabled: update.anonymousQuestionsEnabled,
          askPermission: update.askPermission,
          followUpPermissionDefault: update.followUpPermissionDefault,
          showFollowerCounts: update.showFollowerCounts,
          showLikeCounts: update.showLikeCounts,
          updatedAt: update.updatedAt,
        })
        .where(
          and(eq(profiles.id, update.profileId), eq(profiles.userId, update.userId)),
        );
    },
  };
}

function getPrivacySettingsFormValues(
  formData: FormData,
): PrivacySettingsFormValues {
  const askPermission = getFormText(formData, "askPermission");
  const followUpPermissionDefault = getFormText(
    formData,
    "followUpPermissionDefault",
  );

  return {
    anonymousQuestionsEnabled: hasCheckedValue(formData, "anonymousQuestionsEnabled"),
    askPermission: isAskPermission(askPermission) ? askPermission : "everyone",
    followUpPermissionDefault: isFollowUpPermission(followUpPermissionDefault)
      ? followUpPermissionDefault
      : "anyone",
    showFollowerCounts: hasCheckedValue(formData, "showFollowerCounts"),
    showLikeCounts: hasCheckedValue(formData, "showLikeCounts"),
  };
}

function getPrivacySettingsValues(
  submission: PrivacySettingsSubmission,
): PrivacySettingsFormValues {
  return {
    anonymousQuestionsEnabled: submission.anonymousQuestionsEnabled,
    askPermission: submission.askPermission,
    followUpPermissionDefault: submission.followUpPermissionDefault,
    showFollowerCounts: submission.showFollowerCounts,
    showLikeCounts: submission.showLikeCounts,
  };
}

function getPrivacySettingsFieldErrors(
  error: ZodError,
): PrivacySettingsFieldErrors {
  const fieldErrors: PrivacySettingsFieldErrors = {};

  for (const issue of error.issues) {
    const field = issue.path[0];

    if (
      field === "anonymousQuestionsEnabled" &&
      fieldErrors.anonymousQuestionsEnabled === undefined
    ) {
      fieldErrors.anonymousQuestionsEnabled = issue.message;
    }

    if (field === "askPermission" && fieldErrors.askPermission === undefined) {
      fieldErrors.askPermission = issue.message;
    }

    if (
      field === "followUpPermissionDefault" &&
      fieldErrors.followUpPermissionDefault === undefined
    ) {
      fieldErrors.followUpPermissionDefault = issue.message;
    }

    if (
      field === "showFollowerCounts" &&
      fieldErrors.showFollowerCounts === undefined
    ) {
      fieldErrors.showFollowerCounts = issue.message;
    }

    if (field === "showLikeCounts" && fieldErrors.showLikeCounts === undefined) {
      fieldErrors.showLikeCounts = issue.message;
    }
  }

  return fieldErrors;
}

function hasCheckedValue(formData: FormData, key: string) {
  const value = formData.get(key);

  return (
    typeof value === "string" &&
    ["1", "true", "on", "yes"].includes(value.toLowerCase())
  );
}

function getFormText(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

function isAskPermission(value: string): value is AskPermission {
  return askPermissionValues.includes(value as AskPermission);
}

function isFollowUpPermission(value: string): value is FollowUpPermission {
  return followUpPermissionValues.includes(value as FollowUpPermission);
}
