import { z } from "zod";

import {
  questionGenerationLanguageValues,
  questionGenerationModelPreferenceValues,
  questionGenerationRequestedCountValues,
  questionGenerationStyleValues,
  type QuestionGenerationLanguage,
  type QuestionGenerationModelPreference,
  type QuestionGenerationRequestedCount,
  type QuestionGenerationStyle,
} from "~/features/question-generation/question-generation.constants";

export const questionGenerationSettingsIntentValues = [
  "connect",
  "disconnect",
  "save_preferences",
  "acknowledge_disclosure",
] as const;

export const MAX_QUESTION_GENERATION_INTERESTS = 12;
export const MIN_QUESTION_GENERATION_INTEREST_LENGTH = 2;
export const MAX_QUESTION_GENERATION_INTEREST_LENGTH = 40;

const trimmedString = z.string().transform((value) => value.trim());

const unicodeCharacterString = (maximum: number, message: string) =>
  z.string().refine(
    (value) => Array.from(value).length <= maximum,
    message,
  );

export const questionGenerationRequestSchema = z.object({
  topic: trimmedString
    .pipe(unicodeCharacterString(160, "Topic must be 160 characters or fewer."))
    .optional()
    .default(""),
  language: z.enum(questionGenerationLanguageValues),
  style: z.enum(questionGenerationStyleValues),
  requestedCount: z.union(
    questionGenerationRequestedCountValues.map((value) => z.literal(value)),
  ),
}).strict();

export const generatedQuestionSchema = z.object({
  text: trimmedString.pipe(
    z
      .string()
      .min(1)
      .pipe(unicodeCharacterString(500, "Question must be 500 characters or fewer.")),
  ),
}).strict();

export const generatedQuestionBatchSchema = z.object({
  questions: z.array(generatedQuestionSchema),
}).strict();

export const generatedQuestionBatchJsonSchema = z.toJSONSchema(
  generatedQuestionBatchSchema,
);

export interface QuestionGenerationRequest {
  topic: string;
  language: QuestionGenerationLanguage;
  style: QuestionGenerationStyle;
  requestedCount: QuestionGenerationRequestedCount;
}

export type GeneratedQuestionBatch = z.infer<typeof generatedQuestionBatchSchema>;

const questionGenerationInterestSchema = trimmedString
  .pipe(
    z
      .string()
      .refine(
        (value) => Array.from(value).length >= MIN_QUESTION_GENERATION_INTEREST_LENGTH,
        "Each interest must be at least 2 characters.",
      ),
  )
  .pipe(
    z
      .string()
      .refine(
        (value) => Array.from(value).length <= MAX_QUESTION_GENERATION_INTEREST_LENGTH,
        "Each interest must be 40 characters or fewer.",
      ),
  );

export const questionGenerationPreferencesSchema = z.object({
  modelPreference: z.enum(questionGenerationModelPreferenceValues, {
    error: "Choose an available Gemini model.",
  }),
  questionInterests: z.preprocess(
    normalizeInterestFormValue,
    z
      .array(questionGenerationInterestSchema)
      .max(
        MAX_QUESTION_GENERATION_INTERESTS,
        "You can save up to 12 interests.",
      )
      .superRefine((interests, context) => {
        const seen = new Set<string>();

        for (const [index, interest] of interests.entries()) {
          const normalized = normalizeQuestionGenerationInterest(interest);

          if (seen.has(normalized)) {
            context.addIssue({
              code: "custom",
              message: "Interests must be unique.",
              path: [index],
            });
          }

          seen.add(normalized);
        }
      }),
  ),
});

export const questionGenerationConnectSchema = z.object({
  geminiApiKey: trimmedString.pipe(
    z.string().min(1, "Enter your Gemini API key."),
  ),
  modelPreference: z.enum(questionGenerationModelPreferenceValues, {
    error: "Choose an available Gemini model.",
  }),
});

export const questionGenerationDisclosureSchema = z.object({
  acknowledgeDisclosure: z.literal("true", {
    error: "Acknowledge the data-use disclosure before generating questions.",
  }),
});

export type QuestionGenerationPreferences = z.infer<
  typeof questionGenerationPreferencesSchema
>;

export function normalizeQuestionGenerationInterest(value: string) {
  return value.normalize("NFKC").trim().toLocaleLowerCase("und");
}

function normalizeInterestFormValue(value: unknown) {
  if (typeof value !== "string") {
    return [];
  }

  return value
    .split("\n")
    .map((interest) => interest.trim())
    .filter(Boolean);
}

export function isQuestionGenerationModelPreference(
  value: string,
): value is QuestionGenerationModelPreference {
  return questionGenerationModelPreferenceValues.includes(
    value as QuestionGenerationModelPreference,
  );
}
