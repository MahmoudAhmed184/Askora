import { describe, expect, it } from "vitest";

import { meta } from "~/features/profiles/routes/public-profile.route";
import type { PublicProfilePageData } from "~/features/profiles/queries/profile.queries.server";
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

    expect(tags).toContainEqual({ title: "Profile unavailable | Askora" });
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

  it("emits canonical Open Graph and Twitter metadata", () => {
    const page = createAvailablePage();
    page.profile.bio = "Questions, software, and thoughtful answers.";
    page.profile.avatarUrl = "https://images.example.com/person.jpg";

    const tags = createMeta({
      app: createAppConfig(),
      page,
    });

    const title = "Person (@person) | Askora";
    const description = "Questions, software, and thoughtful answers.";

    expect(tags).toEqual(
      expect.arrayContaining([
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "profile" },
        { property: "og:url", content: "https://app.example.com/person" },
        {
          property: "og:image",
          content: "https://images.example.com/person.jpg",
        },
        { name: "twitter:card", content: "summary" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        {
          name: "twitter:image",
          content: "https://images.example.com/person.jpg",
        },
      ]),
    );
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

function createAvailablePage(): Extract<
  PublicProfilePageData,
  { status: "available" }
> {
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
    nextAnswerCursor: undefined,
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
    appName: "Askora",
    appUrl: "https://app.example.com",
    betaNoindex: false,
    environment: "test",
    ...overrides,
  };
}
