import { Link } from "react-router";

import { DashboardShell } from "~/components/app/dashboard-shell";
import { EmptyState } from "~/components/app/empty-state";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { LikeButton } from "~/features/social/components/like-button";

import type { Route } from "./+types/feed.route";

export async function loader({ request }: Route.LoaderArgs) {
  const { requireCompletedProfileSession } = await import(
    "~/features/auth/auth.server"
  );
  const { loadSocialFeed } = await import(
    "~/features/social/feed.loader.server"
  );
  const { decodeFeedCursor } = await import("~/features/social/social.schema");
  const session = await requireCompletedProfileSession(request);

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
    <DashboardShell>
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-3 border-b pb-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Feed</Badge>
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-semibold tracking-normal">Feed</h1>
            <p className="text-sm leading-6 text-muted-foreground">
              Published answers from profiles you follow.
            </p>
          </div>
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
    </DashboardShell>
  );
}

function FeedItemArticle({
  item,
}: {
  item: Route.ComponentProps["loaderData"]["feed"]["items"][number];
}) {
  return (
    <article className="flex flex-col gap-4 rounded-lg border bg-card p-5 text-card-foreground shadow-sm">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <FeedAvatar item={item} />
          <div className="flex min-w-0 flex-col gap-1">
            <Link
              className="break-words font-medium underline-offset-4 hover:underline"
              to={`/${item.owner.username}`}
            >
              {item.owner.displayName}
            </Link>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span className="break-all">@{item.owner.username}</span>
              <time dateTime={item.publishedAt}>
                {formatDate(item.publishedAt)}
              </time>
            </div>
          </div>
        </div>
        <LikeButton like={item.like} />
      </header>

      {item.questionText === null ? null : (
        <div className="flex flex-col gap-2 border-b pb-4">
          <p className="whitespace-pre-wrap break-words text-base font-medium leading-7">
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

      <p className="whitespace-pre-wrap break-words text-base leading-7">
        {item.answerText}
      </p>

      <footer>
        <Link
          className="text-sm font-medium underline-offset-4 hover:underline"
          to={`/${item.owner.username}/a/${item.threadPublicId}#item-${item.threadItemPublicId}`}
        >
          View thread
        </Link>
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
        className="size-11 shrink-0 rounded-lg border bg-muted object-cover"
        src={item.owner.avatarUrl}
      />
    );
  }

  return (
    <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary text-lg font-semibold text-primary-foreground">
      {item.owner.displayName.slice(0, 1).toUpperCase()}
    </span>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
