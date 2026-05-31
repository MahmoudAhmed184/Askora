import { describe, expect, it } from "vitest";

import {
  privacySettingsSubmissionSchema,
  profileSettingsSubmissionSchema,
} from "~/features/settings/settings.schema";

describe("profileSettingsSubmissionSchema", () => {
  it("trims profile fields and accepts explicit avatar sources", () => {
    expect(
      profileSettingsSubmissionSchema.parse({
        username: "  creator_1  ",
        displayName: "  Person  ",
        bio: "  Ask me about shipping software.  ",
        avatarSource: "google",
      }),
    ).toEqual({
      username: "creator_1",
      displayName: "Person",
      bio: "Ask me about shipping software.",
      avatarSource: "google",
    });

    expect(
      profileSettingsSubmissionSchema.parse({
        username: "creator_1",
        displayName: "Person",
        bio: "",
        avatarSource: "fallback",
      }).bio,
    ).toBeUndefined();
  });

  it("reuses the username policy from profile setup", () => {
    expect(() =>
      profileSettingsSubmissionSchema.parse({
        username: "Creator",
        displayName: "Person",
        avatarSource: "fallback",
      }),
    ).toThrow(/lowercase/i);

    expect(() =>
      profileSettingsSubmissionSchema.parse({
        username: "login",
        displayName: "Person",
        avatarSource: "fallback",
      }),
    ).toThrow(/reserved/i);
  });

  it("validates display name, bio length, and avatar source", () => {
    expect(() =>
      profileSettingsSubmissionSchema.parse({
        username: "creator",
        displayName: " ",
        avatarSource: "fallback",
      }),
    ).toThrow(/display name/i);

    expect(() =>
      profileSettingsSubmissionSchema.parse({
        username: "creator",
        displayName: "a".repeat(51),
        avatarSource: "fallback",
      }),
    ).toThrow(/50/);

    expect(() =>
      profileSettingsSubmissionSchema.parse({
        username: "creator",
        displayName: "Person",
        bio: "a".repeat(161),
        avatarSource: "fallback",
      }),
    ).toThrow(/160/);

    expect(() =>
      profileSettingsSubmissionSchema.parse({
        username: "creator",
        displayName: "Person",
        avatarSource: "https://example.com/avatar.png",
      }),
    ).toThrow(/avatar/i);
  });
});

describe("privacySettingsSubmissionSchema", () => {
  it("parses enums and treats missing checkboxes as false", () => {
    expect(
      privacySettingsSubmissionSchema.parse({
        askPermission: "logged_in",
        followUpPermissionDefault: "original_asker",
      }),
    ).toEqual({
      anonymousQuestionsEnabled: false,
      askPermission: "logged_in",
      followUpPermissionDefault: "original_asker",
      showFollowerCounts: false,
      showLikeCounts: false,
    });
  });

  it("parses checked values independently", () => {
    expect(
      privacySettingsSubmissionSchema.parse({
        anonymousQuestionsEnabled: "on",
        askPermission: "everyone",
        followUpPermissionDefault: "anyone",
        showFollowerCounts: "on",
      }),
    ).toMatchObject({
      anonymousQuestionsEnabled: true,
      showFollowerCounts: true,
      showLikeCounts: false,
    });
  });

  it("rejects unknown permission enum values", () => {
    expect(() =>
      privacySettingsSubmissionSchema.parse({
        askPermission: "friends",
        followUpPermissionDefault: "anyone",
      }),
    ).toThrow(/ask/i);

    expect(() =>
      privacySettingsSubmissionSchema.parse({
        askPermission: "everyone",
        followUpPermissionDefault: "friends",
      }),
    ).toThrow(/follow/i);
  });
});
