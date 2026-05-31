import { z } from "zod";

import { getUsernamePolicyIssue } from "~/features/profile-setup/username-policy";

const trimmedRequiredString = z.string().transform((value) => value.trim());

const optionalTrimmedString = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim().length === 0 ? undefined : value,
  z.string().transform((value) => value.trim()).optional(),
);

export const profileSetupSubmissionSchema = z.object({
  username: trimmedRequiredString.superRefine((username, context) => {
    const issue = getUsernamePolicyIssue(username);

    if (issue !== undefined) {
      context.addIssue({
        code: "custom",
        message: issue,
      });
    }
  }),
  displayName: trimmedRequiredString
    .pipe(z.string().min(1, "Enter a display name."))
    .pipe(z.string().max(50, "Display name must be 50 characters or fewer.")),
  bio: optionalTrimmedString.pipe(
    z.string().max(160, "Bio must be 160 characters or fewer.").optional(),
  ),
});

export type ProfileSetupSubmission = z.infer<
  typeof profileSetupSubmissionSchema
>;
