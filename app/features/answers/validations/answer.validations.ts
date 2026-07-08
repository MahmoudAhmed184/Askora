import { z } from "zod";

import { questionTextModeValues } from "~/db/schema";
import {
  followUpPermissionValues,
  type FollowUpPermission,
} from "~/features/settings/validations/settings.validations";

export const answerIntentValues = ["save_draft", "publish"] as const;
export const publishedAnswerActionIntentValues = [
  "edit",
  "unpublish",
  "delete",
  "pin",
  "unpin",
] as const;

const trimmedAnswerTextSchema = z
  .string()
  .transform((value) => value.trim())
  .pipe(z.string().min(1, "Write an answer."))
  .pipe(z.string().max(3_000, "Answers must be 3,000 characters or fewer."));

const optionalFollowUpPermissionOverrideSchema = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim().length === 0 ? null : value,
  z
    .enum(followUpPermissionValues, {
      error: "Choose who can send follow-ups.",
    })
    .nullable(),
);

export const answerSubmissionSchema = z
  .object({
    intent: z.enum(answerIntentValues, {
      error: "Choose an answer action.",
    }),
    answerText: trimmedAnswerTextSchema,
    questionTextMode: z.enum(questionTextModeValues, {
      error: "Choose how to show the question.",
    }),
    editedQuestionText: z
      .string()
      .transform((value) => value.trim())
      .optional()
      .default(""),
    followUpPermissionOverride: optionalFollowUpPermissionOverrideSchema,
  })
  .superRefine((submission, context) => {
    if (submission.questionTextMode !== "edited") {
      return;
    }

    if (submission.editedQuestionText.length === 0) {
      context.addIssue({
        code: "custom",
        message: "Enter the edited question text.",
        path: ["editedQuestionText"],
      });
    }

    if (submission.editedQuestionText.length > 500) {
      context.addIssue({
        code: "custom",
        message: "Edited questions must be 500 characters or fewer.",
        path: ["editedQuestionText"],
      });
    }
  })
  .transform((submission) => ({
    ...submission,
    editedQuestionText:
      submission.questionTextMode === "edited"
        ? submission.editedQuestionText
        : undefined,
  }));

export const publishedAnswerActionSchema = z.discriminatedUnion("intent", [
  z.object({
    intent: z.literal("edit"),
    answerText: trimmedAnswerTextSchema,
  }),
  z.object({
    intent: z.literal("unpublish"),
  }),
  z.object({
    intent: z.literal("delete"),
  }),
  z.object({
    intent: z.literal("pin"),
  }),
  z.object({
    intent: z.literal("unpin"),
  }),
]);

export type AnswerIntent = (typeof answerIntentValues)[number];
export type PublishedAnswerActionIntent =
  (typeof publishedAnswerActionIntentValues)[number];
export type QuestionTextMode = (typeof questionTextModeValues)[number];
export type AnswerSubmission = z.infer<typeof answerSubmissionSchema>;
export type PublishedAnswerActionSubmission = z.infer<
  typeof publishedAnswerActionSchema
>;
export type AnswerFollowUpPermissionOverride = FollowUpPermission | null;
