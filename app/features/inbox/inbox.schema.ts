import { z } from "zod";

import { moderationReportReasonValues } from "~/db/schema";

export const inboxActionIntentValues = [
  "delete",
  "restore",
  "report",
  "block",
] as const;

export const reportReasonValues = moderationReportReasonValues;

const questionPublicIdSchema = z.string().trim().min(1, "Choose a question.");

const checkboxBooleanSchema = z.preprocess((value) => {
  if (typeof value !== "string") {
    return false;
  }

  return ["1", "true", "on", "yes"].includes(value.toLowerCase());
}, z.boolean());

const optionalReportDetailsSchema = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim().length === 0 ? undefined : value,
  z
    .string()
    .transform((value) => value.trim())
    .pipe(
      z
        .string()
        .max(500, "Report details must be 500 characters or fewer."),
    )
    .optional(),
);

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
  z.object({
    intent: z.literal("report"),
    questionPublicId: questionPublicIdSchema,
    reason: z.enum(reportReasonValues, {
      error: "Choose a report reason.",
    }),
    details: optionalReportDetailsSchema,
    alsoBlockSender: checkboxBooleanSchema,
  }),
]);

export const mutedPhraseSubmissionSchema = z
  .object({
    phrase: z
      .string()
      .transform((value) => value.normalize("NFKC").trim())
      .pipe(z.string().min(1, "Enter a muted phrase."))
      .pipe(
        z.string().max(100, "Muted phrases must be 100 characters or fewer."),
      ),
  })
  .transform(({ phrase }) => ({
    phrase,
    normalizedPhrase: normalizeMutedPhrase(phrase),
  }));

export type InboxActionIntent = (typeof inboxActionIntentValues)[number];
export type InboxActionFormSubmission = z.infer<typeof inboxActionFormSchema>;
export type ReportReason = (typeof reportReasonValues)[number];
export type MutedPhraseSubmission = z.infer<
  typeof mutedPhraseSubmissionSchema
>;

export function normalizeMutedPhrase(phrase: string) {
  return phrase
    .normalize("NFKC")
    .replaceAll(/[\s\p{Separator}]+/gu, " ")
    .trim()
    .toLocaleLowerCase();
}
