import { z } from "zod";

import { getUsernamePolicyIssue } from "~/features/profile-setup/username-policy";

export const avatarSourceValues = ["google", "fallback"] as const;
export const askPermissionValues = [
  "everyone",
  "logged_in",
  "followers",
  "off",
] as const;
export const followUpPermissionValues = [
  "anyone",
  "logged_in",
  "original_asker",
  "off",
] as const;
export const accountActionValues = [
  "deactivate",
  "reactivate",
  "request_deletion",
  "cancel_deletion",
] as const;

const trimmedRequiredString = z.string().transform((value) => value.trim());

const optionalTrimmedString = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim().length === 0 ? undefined : value,
  z.string().transform((value) => value.trim()).optional(),
);

const checkboxBooleanSchema = z.preprocess(
  (value) =>
    typeof value === "string" &&
    ["1", "true", "on", "yes"].includes(value.toLowerCase()),
  z.boolean(),
);

export const profileSettingsSubmissionSchema = z.object({
  username: trimmedRequiredString.superRefine((username, context) => {
    const issue = getUsernamePolicyIssue(username);

    if (issue !== undefined) {
      context.addIssue({
        code: "custom",
        message: issue,
      });
    }
  }),
  displayName: trimmedRequiredString
    .pipe(z.string().min(1, "Enter a display name."))
    .pipe(z.string().max(50, "Display name must be 50 characters or fewer.")),
  bio: optionalTrimmedString.pipe(
    z.string().max(160, "Bio must be 160 characters or fewer.").optional(),
  ),
  avatarSource: z.enum(avatarSourceValues, {
    error: "Choose an avatar source.",
  }),
});

export const privacySettingsSubmissionSchema = z.object({
  anonymousQuestionsEnabled: checkboxBooleanSchema,
  askPermission: z.enum(askPermissionValues, {
    error: "Choose who can ask questions.",
  }),
  followUpPermissionDefault: z.enum(followUpPermissionValues, {
    error: "Choose who can send follow-ups.",
  }),
  showFollowerCounts: checkboxBooleanSchema,
  showLikeCounts: checkboxBooleanSchema,
});

export const accountSettingsSubmissionSchema = z.discriminatedUnion("intent", [
  z.object({
    intent: z.literal("deactivate"),
    confirmation: z.literal("DEACTIVATE", {
      error: "Type DEACTIVATE to deactivate your profile.",
    }),
  }),
  z.object({
    intent: z.literal("reactivate"),
    confirmation: z.string().optional(),
  }),
  z.object({
    intent: z.literal("request_deletion"),
    confirmation: z.literal("DELETE", {
      error: "Type DELETE to request account deletion.",
    }),
  }),
  z.object({
    intent: z.literal("cancel_deletion"),
    confirmation: z.string().optional(),
  }),
]);

export type AccountAction = z.infer<
  typeof accountSettingsSubmissionSchema
>["intent"];
export type AvatarSource = z.infer<
  typeof profileSettingsSubmissionSchema
>["avatarSource"];
export type AskPermission = z.infer<
  typeof privacySettingsSubmissionSchema
>["askPermission"];
export type FollowUpPermission = z.infer<
  typeof privacySettingsSubmissionSchema
>["followUpPermissionDefault"];
export type ProfileSettingsSubmission = z.infer<
  typeof profileSettingsSubmissionSchema
>;
export type PrivacySettingsSubmission = z.infer<
  typeof privacySettingsSubmissionSchema
>;
export type AccountSettingsSubmission = z.infer<
  typeof accountSettingsSubmissionSchema
>;
