import { z } from "zod";

export const inviteCodeSchema = z.preprocess(
  (value) =>
    typeof value === "string" ? value.trim().toUpperCase() : value,
  z
    .string()
    .min(8, "Invite codes must be at least 8 characters.")
    .max(64, "Invite codes must be 64 characters or fewer.")
    .regex(/^[A-Z0-9-]+$/, "Invite codes may contain A-Z, 0-9, and dashes."),
);

export type InviteCode = z.infer<typeof inviteCodeSchema>;
