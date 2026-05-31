import { z } from "zod";

export const publicQuestionIdentityValues = ["anonymous", "attributed"] as const;

const trimmedQuestionText = z.string().transform((value) => value.trim());

export const publicQuestionSubmissionSchema = z.object({
  question: trimmedQuestionText
    .pipe(z.string().min(1, "Enter a question."))
    .pipe(z.string().max(500, "Questions must be 500 characters or fewer.")),
  identityMode: z.enum(publicQuestionIdentityValues, {
    error: "Choose how to ask this question.",
  }),
  timingToken: z.string().min(1, "Reload this page and try again."),
  website: z.string().optional(),
});

export type PublicQuestionIdentity = z.infer<
  typeof publicQuestionSubmissionSchema
>["identityMode"];
export type PublicQuestionSubmission = z.infer<
  typeof publicQuestionSubmissionSchema
>;
