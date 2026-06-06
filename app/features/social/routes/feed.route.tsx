import { MessageCircle } from "lucide-react";
import { Link, useLocation } from "react-router";

import { EmptyState } from "~/components/app/empty-state";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { requireCompletedProfileSessionFromContext } from "~/features/auth/auth.server";
import { LikeButton } from "~/features/social/components/like-button";
import { loadSocialFeed } from "~/features/social/feed.loader.server";
import { decodeFeedCursor } from "~/features/social/social.schema";
import { formatMediumDateTime } from "~/lib/date-format";

import type { Route } from "./+types/feed.route";

export async function loader({ context, request }: Route.LoaderArgs) {
  const session = requireCompletedProfileSessionFromContext(context);

  if (session instanceof Response) {
    return session;
  }
  const cursor = new URL(request.url).searchParams.get("cursor") ?? undefined;

  return {
    feed: await loadSocialFeed({
      cursor: decodeFeedCursor(cursor),
      session,
    }),
  };
}

export function meta() {
  return [{ title: "Feed | qna-platform" }];
}

export default function FeedRoute({ loaderData }: Route.ComponentProps) {
  const { feed } = loaderData;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-2 pb-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-serif text-2xl font-bold leading-tight text-foreground">
            Following Feed
          </h1>
          <Badge variant="secondary">Chronological</Badge>
        </div>
        <p className="text-sm leading-6 text-muted-foreground">
          Newest published answers from followed profiles only.
        </p>
      </header>

      {feed.items.length === 0 ? (
        <EmptyState
          description="Follow active profiles to see their published answers here."
          title="No feed items yet"
        />
      ) : (
        <section aria-label="Feed items" className="flex flex-col gap-3">
          {feed.items.map((item) => (
            <FeedItemArticle item={item} key={item.threadItemPublicId} />
          ))}
        </section>
      )}

      {feed.nextCursor === undefined ? null : (
        <div className="flex justify-center pt-2">
          <Button asChild variant="outline">
            <Link
              to={`/dashboard/feed?cursor=${encodeURIComponent(
                feed.nextCursor,
              )}`}
            >
              Load more
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}

function FeedItemArticle({
  item,
}: {
  item: Route.ComponentProps["loaderData"]["feed"]["items"][number];
}) {
  const location = useLocation();
  const threadHref = createThreadHref({
    location,
    ownerUsername: item.owner.username,
    threadPublicId: item.threadPublicId,
  });

  return (
    <article className="flex flex-col gap-5 rounded-3xl border bg-card p-6 text-card-foreground shadow-[var(--shadow-card)] transition-[border-color] duration-[250ms] ease-[ease] hover:border-border-strong">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex min-w-0 gap-3">
          <FeedAvatar item={item} />
          <div className="flex min-w-0 flex-col gap-1">
            <Link
              className="break-words font-medium underline-offset-4 hover:underline"
              to={`/${item.owner.username}`}
            >
              {item.owner.displayName}
            </Link>
            <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-muted-foreground">
              <span className="break-all">@{item.owner.username}</span>
              <time dateTime={item.publishedAt}>
                {formatDate(item.publishedAt)}
              </time>
            </div>
          </div>
        </div>
      </header>

      {item.questionText === null ? null : (
        <div className="flex flex-col gap-2 border-b border-dashed pb-5">
          <p className="whitespace-pre-wrap break-words font-serif text-xl font-bold italic leading-8 text-foreground">
            {item.questionText}
          </p>
          {item.asker === undefined ? null : (
            <p className="text-sm leading-6 text-muted-foreground">
              Asked by{" "}
              <span className="font-medium text-foreground">
                {item.asker.displayName}
              </span>{" "}
              @{item.asker.username}
            </p>
          )}
        </div>
      )}

      <p className="whitespace-pre-wrap break-words text-[0.96rem] leading-8 text-foreground/85 sm:text-base">
        {item.answerText}
      </p>

      <footer className="flex flex-col gap-3 border-t border-dashed pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <LikeButton like={item.like} />
          <Link
            className="inline-flex h-9 items-center gap-2 rounded-full border bg-secondary px-3.5 text-sm font-semibold text-secondary-foreground transition-[border-color,background-color,box-shadow,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-px hover:border-primary/40 hover:bg-primary/10 hover:shadow-[0_4px_14px_var(--accent-glow)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            to={threadHref}
          >
            <MessageCircle data-icon="inline-start" />
            Thread
          </Link>
        </div>
      </footer>
    </article>
  );
}

function FeedAvatar({
  item,
}: {
  item: Route.ComponentProps["loaderData"]["feed"]["items"][number];
}) {
  if (item.owner.avatarUrl !== null) {
    return (
      <img
        alt=""
        className="size-11 shrink-0 rounded-full border bg-muted object-cover"
        decoding="async"
        loading="lazy"
        src={item.owner.avatarUrl}
      />
    );
  }

  return (
    <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary font-serif text-lg font-bold text-primary">
      {item.owner.displayName.slice(0, 1).toUpperCase()}
    </span>
  );
}

function formatDate(value: string) {
  return formatMediumDateTime(value);
}

function createThreadHref({
  location,
  ownerUsername,
  threadPublicId,
}: {
  location: {
    hash: string;
    pathname: string;
    search: string;
  };
  ownerUsername: string;
  threadPublicId: string;
}) {
  const returnTo = `${location.pathname}${location.search}${location.hash}`;
  const params = new URLSearchParams({ returnTo });

  return `/${ownerUsername}/a/${threadPublicId}?${params.toString()}`;
}
