export const moderationReportTargetTypeValues = [
  "question",
  "thread_item",
  "profile",
] as const;

export const moderationReportReasonValues = [
  "harassment",
  "hate",
  "threats",
  "sexual_content",
  "self_harm",
  "private_information",
  "impersonation",
  "spam_scam",
  "other",
] as const;

export const moderationReportStatusValues = [
  "open",
  "reviewed",
  "actioned",
  "dismissed",
] as const;

export const adminActionTypeValues = [
  "dismiss",
  "warn",
  "suspend_7_days",
  "suspend_30_days",
  "permanent_suspension",
  "hide_profile",
  "remove_public_content",
] as const;

export type ModerationReportReason =
  (typeof moderationReportReasonValues)[number];

export type AdminActionType = (typeof adminActionTypeValues)[number];
