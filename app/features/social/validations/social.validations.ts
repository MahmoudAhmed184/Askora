import { Buffer } from "node:buffer";

import { z } from "zod";

export const likeIntentValues = ["like", "unlike"] as const;
export const followIntentValues = ["follow", "unfollow"] as const;

const optionalFormStringSchema = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim().length === 0
      ? undefined
      : value,
  z.string().trim().optional(),
);

export const likeActionSchema = z.object({
  intent: z.enum(likeIntentValues),
  threadItemPublicId: z.string().trim().min(1, "Answer is required."),
  returnTo: optionalFormStringSchema,
});

export const followActionSchema = z.object({
  intent: z.enum(followIntentValues),
  username: z.string().trim().min(1, "Profile is required."),
  returnTo: optionalFormStringSchema,
});

export const feedCursorSchema = z.object({
  publishedAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
  publicId: z.string().min(1),
});

export type LikeIntent = (typeof likeIntentValues)[number];
export type FollowIntent = (typeof followIntentValues)[number];
export type LikeActionSubmission = z.infer<typeof likeActionSchema>;
export type FollowActionSubmission = z.infer<typeof followActionSchema>;
export type FeedCursor = z.infer<typeof feedCursorSchema>;

export function encodeFeedCursor(cursor: FeedCursor) {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeFeedCursor(value: string | undefined) {
  if (value === undefined || value.trim().length === 0) {
    return undefined;
  }

  try {
    const decoded: unknown = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as unknown;
    const parsed = feedCursorSchema.safeParse(decoded);

    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

export function getSafeReturnTo(
  returnTo: string | undefined,
  fallback = "/feed",
) {
  if (
    returnTo === undefined ||
    !returnTo.startsWith("/") ||
    returnTo.startsWith("//")
  ) {
    return fallback;
  }

  return returnTo;
}
