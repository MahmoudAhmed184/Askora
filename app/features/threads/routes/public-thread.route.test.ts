import { describe, expect, it } from "vitest";

import {
  createPublicThreadHeaders,
  createPublicThreadMeta,
} from "~/features/threads/public-thread-meta";
import type { PublicThreadPageData } from "~/features/threads/public-thread.loader.server";
import type { PublicAppConfig } from "~/lib/config.server";

describe("public thread route metadata", () => {
  it("uses public answer text without hidden question text in meta or OG tags", () => {
    const meta = createPublicThreadMeta({
      app: createAppConfig(),
      page: createAvailablePage(),
    });
    const serializedMeta = JSON.stringify(meta);

    expect(meta).toContainEqual({
      title: "Answer thread by Person (@person) | Q&A",
    });
    expect(meta).toContainEqual({
      name: "description",
      content: "Public answer for the thread.",
    });
    expect(meta).toContainEqual({
      property: "og:description",
      content: "Public answer for the thread.",
    });
    expect(meta).toContainEqual({
      property: "og:url",
      content: "https://app.example.com/person/a/thr_1",
    });
    expect(meta).toContainEqual({
      property: "og:image",
      content: "https://app.example.com/avatar.png",
    });
    expect(serializedMeta).not.toContain("Secret hidden question");
  });

  it("uses generic unavailable meta", () => {
    const meta = createPublicThreadMeta({
      app: createAppConfig(),
      page: {
        status: "unavailable",
        username: "person",
        threadPublicId: "thr_missing",
      },
    });

    expect(meta).toContainEqual({ title: "Thread unavailable | Q&A" });
    expect(meta).toContainEqual({
      name: "description",
      content: "This answer thread is unavailable.",
    });
    expect(meta).toContainEqual({
      name: "robots",
      content: "noindex,nofollow",
    });
    expect(JSON.stringify(meta)).not.toContain("Secret hidden question");
  });

  it("preserves loader noindex headers for unavailable responses", () => {
    const headers = createPublicThreadHeaders({
      app: createAppConfig(),
      loaderHeaders: new Headers({
        "X-Robots-Tag": "noindex, nofollow",
      }),
    });

    expect(headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
  });

  it("emits beta robots meta and noindex headers", () => {
    const betaApp = createAppConfig({ betaNoindex: true });
    const meta = createPublicThreadMeta({
      app: betaApp,
      page: createAvailablePage(),
    });
    const headers = createPublicThreadHeaders({
      app: betaApp,
      loaderHeaders: new Headers(),
    });

    expect(meta).toContainEqual({
      name: "robots",
      content: "noindex,nofollow",
    });
    expect(headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
  });
});

function createAvailablePage(): PublicThreadPageData {
  return {
    status: "available",
    profile: {
      username: "person",
      displayName: "Person",
      avatarUrl: "https://app.example.com/avatar.png",
    },
    thread: {
      publicId: "thr_1",
      publishedAt: "2026-05-31T12:00:00.000Z",
    },
    items: [
      {
        type: "answer",
        publicId: "titem_1",
        answerText: "Public answer for the thread.",
        publishedAt: "2026-05-31T12:00:00.000Z",
        pinPosition: null,
        like: {
          threadItemPublicId: "titem_1",
          isLiked: false,
          count: 0,
          disabled: true,
        },
      },
    ],
    followUp: {
      status: "allowed",
      defaultIdentity: "anonymous",
      anonymousAllowed: true,
      attributedAllowed: false,
      description: "Your follow-up is anonymous to the recipient and public viewers.",
      effectivePermission: "anyone",
    },
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
