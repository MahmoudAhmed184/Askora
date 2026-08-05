export const QUESTION_GENERATION_MODELS = {
  auto: "auto",
  gemini36Flash: "gemini-3.6-flash",
  gemini31FlashLite: "gemini-3.1-flash-lite",
} as const;

export const QUESTION_GENERATION_AUTO_MODEL =
  QUESTION_GENERATION_MODELS.gemini36Flash;

export const QUESTION_GENERATION_DISCLOSURE_VERSION = 1;

export const questionGenerationModelPreferenceValues = [
  QUESTION_GENERATION_MODELS.auto,
  QUESTION_GENERATION_MODELS.gemini36Flash,
  QUESTION_GENERATION_MODELS.gemini31FlashLite,
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
