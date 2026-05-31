import { z } from "zod";

import {
  adminActionTypeValues,
  moderationReportStatusValues,
} from "~/db/schema/moderation-values";

export const adminQueueStatusValues = moderationReportStatusValues;
export const adminActionValues = adminActionTypeValues;

export const adminQueueStatusSchema = z.enum(adminQueueStatusValues).catch("open");

export const adminActionNotesSchema = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim().length === 0 ? undefined : value,
  z
    .string()
    .transform((value) => value.trim())
    .pipe(z.string().max(1_000, "Notes must be 1,000 characters or fewer."))
    .optional(),
);

export const adminActionFormSchema = z
  .object({
    actionType: z.enum(adminActionValues, {
      error: "Choose a moderation action.",
    }),
    notes: adminActionNotesSchema,
  })
  .superRefine((value, context) => {
    if (
      requiresAdminActionNotes(value.actionType) &&
      value.notes === undefined
    ) {
      context.addIssue({
        code: "custom",
        message: "Notes are required for this action.",
        path: ["notes"],
      });
    }
  });

export type AdminQueueStatus = z.infer<typeof adminQueueStatusSchema>;
export type AdminActionType = (typeof adminActionValues)[number];
export type AdminActionSubmission = z.infer<typeof adminActionFormSchema>;

export function parseAdminQueueStatus(value: string | null) {
  return adminQueueStatusSchema.parse(value ?? "open");
}

export function requiresAdminActionNotes(actionType: AdminActionType) {
  return (
    actionType === "suspend_7_days" ||
    actionType === "suspend_30_days" ||
    actionType === "permanent_suspension" ||
    actionType === "remove_public_content"
  );
}
