import { describe, expect, it } from "vitest";

import { profileSetupSubmissionSchema } from "~/features/profile-setup/validations/profile-setup.validations";

describe("profileSetupSubmissionSchema", () => {
  it("trims username, display name, and bio without lowercasing username", () => {
    const parsed = profileSetupSubmissionSchema.safeParse({
      username: "  Creator  ",
      displayName: "  Person  ",
      bio: "  Ask me about shipping software.  ",
    });

    expect(parsed.success).toBe(false);
  });

  it("accepts trimmed setup fields", () => {
    const parsed = profileSetupSubmissionSchema.parse({
      username: "  creator  ",
      displayName: "  Person  ",
      bio: "  Ask me about shipping software.  ",
    });

    expect(parsed).toEqual({
      username: "creator",
      displayName: "Person",
      bio: "Ask me about shipping software.",
    });
  });

  it("requires display name length between 1 and 50", () => {
    expect(() =>
      profileSetupSubmissionSchema.parse({
        username: "creator",
        displayName: " ",
      }),
    ).toThrow(/display name/i);

    expect(() =>
      profileSetupSubmissionSchema.parse({
        username: "creator",
        displayName: "a".repeat(51),
      }),
    ).toThrow(/50/);
  });

  it("allows empty bio and enforces the 160 character limit", () => {
    expect(
      profileSetupSubmissionSchema.parse({
        username: "creator",
        displayName: "Person",
        bio: " ",
      }).bio,
    ).toBeUndefined();

    expect(() =>
      profileSetupSubmissionSchema.parse({
        username: "creator",
        displayName: "Person",
        bio: "a".repeat(161),
      }),
    ).toThrow(/160/);
  });
});
