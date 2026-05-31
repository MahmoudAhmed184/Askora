import { z } from "zod";

export const magicLinkRequestSchema = z.object({
  email: z.preprocess(
    (value) =>
      typeof value === "string" ? value.trim().toLowerCase() : value,
    z.email("Enter a valid email address."),
  ),
});

export type MagicLinkRequest = z.infer<typeof magicLinkRequestSchema>;
