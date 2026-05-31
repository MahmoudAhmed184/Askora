import { z } from "zod";

import {
  questionReportFieldsSchema,
} from "~/features/moderation/moderation.schema";
export {
  mutedPhraseSubmissionSchema,
  normalizeMutedPhrase,
  reportReasonValues,
} from "~/features/moderation/moderation.schema";
export type {
  MutedPhraseSubmission,
  ReportReason,
} from "~/features/moderation/moderation.schema";

export const inboxActionIntentValues = [
  "delete",
  "restore",
  "report",
  "block",
] as const;

const questionPublicIdSchema = z.string().trim().min(1, "Choose a question.");

export const inboxActionFormSchema = z.discriminatedUnion("intent", [
  z.object({
    intent: z.literal("delete"),
    questionPublicId: questionPublicIdSchema,
  }),
  z.object({
    intent: z.literal("restore"),
    questionPublicId: questionPublicIdSchema,
  }),
  z.object({
    intent: z.literal("block"),
    questionPublicId: questionPublicIdSchema,
  }),
  z
    .object({
      intent: z.literal("report"),
      questionPublicId: questionPublicIdSchema,
    })
    .extend(questionReportFieldsSchema.shape),
]);

export type InboxActionIntent = (typeof inboxActionIntentValues)[number];
export type InboxActionFormSubmission = z.infer<typeof inboxActionFormSchema>;
