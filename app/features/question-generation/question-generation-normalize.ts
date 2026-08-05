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
