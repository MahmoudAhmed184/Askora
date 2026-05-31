import type { z, ZodError, ZodType } from "zod";

import { err, ok, type Result } from "~/lib/result";

export function parseFormData<TSchema extends ZodType>(
  schema: TSchema,
  formData: FormData,
): Result<z.infer<TSchema>, ZodError> {
  const parsed = schema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return err(parsed.error);
  }

  return ok(parsed.data);
}

export function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
