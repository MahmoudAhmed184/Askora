export const QUESTION_GENERATION_MODELS = {
  auto: "auto",
  gemini36Flash: "gemini-3.6-flash",
  gemini35FlashLite: "gemini-3.5-flash-lite",
} as const;

export const QUESTION_GENERATION_AUTO_MODEL =
  QUESTION_GENERATION_MODELS.gemini36Flash;

export const QUESTION_GENERATION_AUTO_FALLBACK_MODEL = "gemini-3.5-flash";

export const questionGenerationLanguageValues = [
  "egyptian_arabic",
  "modern_standard_arabic",
  "english",
] as const;

export const questionGenerationStyleValues = [
  "balanced",
  "deep_reflective",
  "professional",
  "personal",
  "light_fun",
  "surprise_me",
] as const;

export const questionGenerationRequestedCountValues = [3, 5, 10] as const;

export type QuestionGenerationLanguage =
  (typeof questionGenerationLanguageValues)[number];

export type QuestionGenerationStyle =
  (typeof questionGenerationStyleValues)[number];

export type QuestionGenerationRequestedCount =
  (typeof questionGenerationRequestedCountValues)[number];

export const QUESTION_GENERATION_DISCLOSURE_VERSION = 1;

export const questionGenerationModelPreferenceValues = [
  QUESTION_GENERATION_MODELS.auto,
  QUESTION_GENERATION_MODELS.gemini36Flash,
  QUESTION_GENERATION_MODELS.gemini35FlashLite,
] as const;

export type QuestionGenerationModelPreference =
  (typeof questionGenerationModelPreferenceValues)[number];

export function resolveQuestionGenerationModel(
  preference: QuestionGenerationModelPreference,
) {
  return preference === QUESTION_GENERATION_MODELS.auto
    ? QUESTION_GENERATION_AUTO_MODEL
    : preference;
}
