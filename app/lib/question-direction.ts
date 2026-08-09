export type QuestionDisplayDirection = "rtl" | "ltr";

export function getQuestionDirection(text: string): QuestionDisplayDirection {
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
