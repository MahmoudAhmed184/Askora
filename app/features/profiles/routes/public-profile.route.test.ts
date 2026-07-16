import { describe, expect, it } from "vitest";

import { meta } from "~/features/profiles/routes/public-profile.route";
import type {
  PublicProfilePageData
} from "~/features/profiles/queries/profile.queries.server";;
import type { PublicAppConfig } from "~/lib/config.types";

describe("public profile route metadata", () => {
  it("marks unavailable profiles noindex with generic copy", () => {
    const tags = createMeta({
      app: createAppConfig(),
      page: {
        status: "unavailable",
        username: "person",
      },
    });

    expect(tags).toContainEqual({ title: "Profile unavailable | Q&A" });
    expect(tags).toContainEqual({
      name: "robots",
      content: "noindex,nofollow",
    });
    expect(JSON.stringify(tags)).not.toContain("deleted");
    expect(JSON.stringify(tags)).not.toContain("deactivated");
  });

  it("uses beta noindex meta for available profiles", () => {
    const tags = createMeta({
      app: createAppConfig({ betaNoindex: true }),
      page: createAvailablePage(),
    });

    expect(tags).toContainEqual({
      name: "robots",
      content: "noindex,nofollow",
    });
  });
});

function createMeta(loaderData: {
  app: PublicAppConfig;
  page: PublicProfilePageData;
}) {
  return meta({
    loaderData,
  } as Parameters<typeof meta>[0]);
}

function createAvailablePage(): PublicProfilePageData {
  return {
    status: "available",
    profile: {
      username: "person",
      displayName: "Person",
      avatarUrl: null,
      bio: null,
      askSettings: {
        acceptingQuestions: true,
        anonymousQuestionsEnabled: true,
        permission: "everyone",
      },
      counts: {
        answers: 0,
        followers: 0,
        following: 0,
        reactions: 0,
      },
    },
    ask: {
      status: "allowed",
      defaultIdentity: "anonymous",
      anonymousAllowed: true,
      attributedAllowed: false,
      description: "Ask anonymously.",
    },
    askFlash: undefined,
    timingToken: undefined,
    publishedAnswers: [],
    publishedAnswerControls: {
      canManage: false,
      disabled: false,
    },
    follow: {
      visible: false,
      username: "person",
      isFollowing: false,
      disabled: false,
    },
    canReport: false,
  };
}

function createAppConfig(
  overrides: Partial<PublicAppConfig> = {},
): PublicAppConfig {
  return {
    appName: "Q&A",
    appUrl: "https://app.example.com",
    betaNoindex: false,
    environment: "test",
    ...overrides,
  };
}
