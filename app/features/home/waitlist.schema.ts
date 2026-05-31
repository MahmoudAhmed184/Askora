import { z } from "zod";

export const waitlistEmailSchema = z.preprocess(
  (value) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  z.email("Enter a valid email address."),
);

export const waitlistSubmissionSchema = z.object({
  email: waitlistEmailSchema,
});

export type WaitlistSubmission = z.infer<typeof waitlistSubmissionSchema>;
