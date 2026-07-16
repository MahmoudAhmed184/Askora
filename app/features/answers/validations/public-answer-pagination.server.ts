import { Buffer } from "node:buffer";

import { z } from "zod";

const serializedPublicAnswerCursorSchema = z.object({
  publishedAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
  publicId: z.string().min(1),
});

export interface PublicAnswerCursor {
  publishedAt: Date;
  createdAt: Date;
  publicId: string;
}

export function encodePublicAnswerCursor(cursor: PublicAnswerCursor) {
  return Buffer.from(
    JSON.stringify({
      publishedAt: cursor.publishedAt.toISOString(),
      createdAt: cursor.createdAt.toISOString(),
      publicId: cursor.publicId,
    }),
    "utf8",
  ).toString("base64url");
}

export function decodePublicAnswerCursor(value: string | undefined) {
  if (value === undefined || value.trim().length === 0) {
    return undefined;
  }

  try {
    const decoded: unknown = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as unknown;
    const parsed = serializedPublicAnswerCursorSchema.safeParse(decoded);

    return parsed.success
      ? {
          publishedAt: new Date(parsed.data.publishedAt),
          createdAt: new Date(parsed.data.createdAt),
          publicId: parsed.data.publicId,
        }
      : undefined;
  } catch {
    return undefined;
  }
}
