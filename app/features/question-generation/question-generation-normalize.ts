export function normalizeQuestionGenerationText(value: string) {
  return value
    .normalize("NFKC")
    .replaceAll(/[\u0640]/g, "")
    .replaceAll(/[إأآٱ]/g, "ا")
    .replaceAll(/ى/g, "ي")
    .replaceAll(/[،؛]/g, ",")
    .replaceAll(/[؟?]+\s*$/g, "")
    .replaceAll(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("und");
}

/**
 * Hash normalization used before question-generation shipped its Unicode and
 * punctuation canonicalization. Keep it available for duplicate compatibility
 * lookups while old rows are gradually replaced by normal writes.
 */
export function normalizeLegacyQuestionText(value: string) {
  return value.replaceAll(/\s+/g, " ").trim().toLowerCase();
}
