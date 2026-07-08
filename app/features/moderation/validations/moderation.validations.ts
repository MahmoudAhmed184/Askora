import { z } from "zod";

import { moderationReportReasonValues } from "~/db/schema/moderation-values";

export const reportReasonValues = moderationReportReasonValues;

export const checkboxBooleanSchema = z.preprocess((value) => {
  if (typeof value !== "string") {
    return false;
  }

  return ["1", "true", "on", "yes"].includes(value.toLowerCase());
}, z.boolean());

export const optionalReportDetailsSchema = z.preprocess(
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

export const questionReportFieldsSchema = z.object({
  reason: z.enum(reportReasonValues, {
    error: "Choose a report reason.",
  }),
  details: optionalReportDetailsSchema,
  alsoBlockSender: checkboxBooleanSchema,
});

export const mutedPhraseTextSchema = z
  .string()
  .transform((value) => value.normalize("NFKC").trim())
  .pipe(z.string().min(1, "Enter a muted phrase."))
  .pipe(z.string().max(100, "Muted phrases must be 100 characters or fewer."));

export const mutedPhraseSubmissionSchema = z
  .object({
    phrase: mutedPhraseTextSchema,
  })
  .transform(({ phrase }) => ({
    phrase,
    normalizedPhrase: normalizeMutedPhrase(phrase),
  }));

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
