import type { PublicAppConfig } from "~/lib/config.types";
import type {
  PublicThreadAnswerItem,
  PublicThreadItem,
  PublicThreadPageData,
} from "~/features/threads/types/threads.types";

const publicNoindexHeaders = {
  "X-Robots-Tag": "noindex, nofollow",
} as const;

export function createPublicNoindexHeaders({
  loaderHeaders,
  noindex,
}: {
  loaderHeaders: Headers;
  noindex: boolean;
}) {
  const headers = new Headers(loaderHeaders);

  if (noindex) {
    for (const [name, value] of Object.entries(publicNoindexHeaders)) {
      headers.set(name, value);
    }
  }

  return headers;
}

export function createRobotsMetaTag(noindex: boolean) {
  return noindex ? { name: "robots", content: "noindex,nofollow" } : undefined;
}

export function createPublicThreadHeaders({
  app,
  loaderHeaders,
}: {
  app: PublicAppConfig;
  loaderHeaders: Headers;
}) {
  return createPublicNoindexHeaders({
    loaderHeaders,
    noindex: app.betaNoindex,
  });
}

export function createPublicThreadMeta({
  app,
  page,
}: {
  app: PublicAppConfig;
  page: PublicThreadPageData;
}) {
  const meta = getPublicThreadMetaContent({ app, page });
  const tags = [
    { title: meta.title },
    { name: "description", content: meta.description },
    { property: "og:title", content: meta.title },
    { property: "og:description", content: meta.description },
    { property: "og:type", content: "article" },
    { property: "og:url", content: meta.url },
  ];

  const robotsMeta = createRobotsMetaTag(meta.noindex);

  if (robotsMeta !== undefined) {
    tags.push(robotsMeta);
  }

  if (meta.image !== undefined) {
    tags.push({ property: "og:image", content: meta.image });
  }

  return tags;
}

function getPublicThreadMetaContent({
  app,
  page,
}: {
  app: PublicAppConfig;
  page: PublicThreadPageData;
}) {
  if (page.status === "unavailable") {
    return {
      title: `Thread unavailable | ${app.appName}`,
      description: "This answer thread is unavailable.",
      noindex: true,
      url: buildPublicThreadUrl({
        app,
        threadPublicId: page.threadPublicId,
        username: page.username,
      }),
      image: undefined,
    };
  }

  const firstAnswer = page.items.find(isPublicThreadAnswerItem);
  const title = `Answer thread by ${page.profile.displayName} (@${page.profile.username}) | ${app.appName}`;

  return {
    title,
    description:
      firstAnswer === undefined
        ? `Read this answer thread by ${page.profile.displayName} on ${app.appName}.`
        : createMetaDescription(firstAnswer.answerText),
    noindex: app.betaNoindex,
    url: buildPublicThreadUrl({
      app,
      threadPublicId: page.thread.publicId,
      username: page.profile.username,
    }),
    image: page.profile.avatarUrl ?? undefined,
  };
}

function createMetaDescription(answerText: string) {
  const normalizedAnswer = answerText.replaceAll(/\s+/g, " ").trim();

  if (normalizedAnswer.length <= 160) {
    return normalizedAnswer;
  }

  return `${normalizedAnswer.slice(0, 157).trimEnd()}...`;
}

function buildPublicThreadUrl({
  app,
  threadPublicId,
  username,
}: {
  app: PublicAppConfig;
  username: string;
  threadPublicId: string;
}) {
  return `${app.appUrl.replace(/\/$/, "")}/${username}/a/${threadPublicId}`;
}

function isPublicThreadAnswerItem(
  item: PublicThreadItem,
): item is PublicThreadAnswerItem {
  return item.type === "answer";
}
