import type { QuestionGenerationLanguage } from "~/features/question-generation/question-generation.constants";

export type QuestionDisplayDirection = "rtl" | "ltr";

export function getQuestionGenerationDirection(
  language: QuestionGenerationLanguage | null | undefined,
  text = "",
): QuestionDisplayDirection {
  if (language !== undefined && language !== null) {
    return language === "english" ? "ltr" : "rtl";
  }

  // Use the first strong character for ordinary questions. This fallback is
  // deliberately deterministic and never exposes source/batch metadata.
  for (const character of text) {
    if (/\p{Script=Arabic}/u.test(character)) {
      return "rtl";
    }

    if (/\p{L}/u.test(character)) {
      return "ltr";
    }
  }

  return "ltr";
}
