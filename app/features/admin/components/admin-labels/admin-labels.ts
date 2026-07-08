import type { AdminActionType } from "~/features/admin/validations/admin.validations";
import type {
  AdminReportReason,
  AdminReportStatus,
  AdminReportTargetType,
} from "~/features/admin/types/admin.types";

export const adminActionLabels: Record<AdminActionType, string> = {
  dismiss: "Dismiss report",
  warn: "Warn account",
  suspend_7_days: "Suspend for 7 days",
  suspend_30_days: "Suspend for 30 days",
  permanent_suspension: "Suspend permanently",
  hide_profile: "Hide profile",
  remove_public_content: "Remove public content",
};

export const reportReasonLabels: Record<AdminReportReason, string> = {
  harassment: "Harassment",
  hate: "Hate",
  threats: "Threats",
  sexual_content: "Sexual content",
  self_harm: "Self-harm",
  private_information: "Private information",
  impersonation: "Impersonation",
  spam_scam: "Spam or scam",
  other: "Other",
};

export const reportStatusLabels: Record<AdminReportStatus, string> = {
  open: "Open",
  reviewed: "Reviewed",
  actioned: "Actioned",
  dismissed: "Dismissed",
};

export const targetTypeLabels: Record<AdminReportTargetType, string> = {
  question: "Question",
  thread_item: "Public answer",
  profile: "Profile",
};
