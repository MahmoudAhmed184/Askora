import { MessageCircle } from "lucide-react";
import {
  Link,
  type ShouldRevalidateFunctionArgs,
  useLocation,
} from "react-router";

import { EditedQuestionBadge } from "~/components/shared/edited-question-badge/edited-question-badge";
import { EmptyState } from "~/components/shared/empty-state/empty-state";
import { ProfileIdentityLink } from "~/components/shared/profile-identity/profile-identity";
import { PageHeader } from "~/components/shared/page-header/page-header";
import { Badge } from "~/components/ui/badge/badge";
import { Button } from "~/components/ui/button/button";
import { requireCompletedProfileSessionFromContext } from "~/features/auth/services/auth.service.server";
import { LikeButton } from "~/features/social/components/like-button";
import { loadSocialFeed } from "~/features/social/queries/feed.queries.server";
import { decodeFeedCursor } from "~/features/social/validations/social.validations";
import {
  createThreadModalLink,
  isThreadModalOnlySearchParamChange,
} from "~/features/threads/thread-modal";
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
  return [{ title: "Feed | Askora" }];
}

export function shouldRevalidate({
  currentUrl,
  defaultShouldRevalidate,
  nextUrl,
}: ShouldRevalidateFunctionArgs) {
  if (isThreadModalOnlySearchParamChange(currentUrl, nextUrl)) {
    return false;
  }

  return defaultShouldRevalidate;
}

export default function FeedRoute({ loaderData }: Route.ComponentProps) {
  const { feed } = loaderData;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader
        actions={<Badge variant="secondary">Chronological</Badge>}
        description="Newest published answers from followed profiles only."
        title="Feed"
      />

      {feed.items.length === 0 ? (
        <EmptyState
          description="Follow active profiles to see their published answers here."
          icon={<MessageCircle aria-hidden="true" />}
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
            <Link to={`/feed?cursor=${encodeURIComponent(feed.nextCursor)}`}>
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
      <header>
        <ProfileIdentityLink
          meta={
            <>
              <span aria-hidden="true">·</span>
              <time dateTime={item.publishedAt}>
                {formatDate(item.publishedAt)}
              </time>
            </>
          }
          profile={item.owner}
        />
      </header>

      {item.questionText === null ? null : (
        <div className="flex flex-col gap-2 border-b border-dashed pb-5">
          <div className="flex flex-wrap items-baseline gap-2">
            <p className="min-w-0 flex-1 whitespace-pre-wrap break-words font-serif text-xl font-bold italic leading-8 text-foreground">
              {item.questionText}
            </p>
            {item.questionTextMode === "edited" ? (
              <EditedQuestionBadge />
            ) : null}
          </div>
          {item.asker === undefined ? null : (
            <p className="text-sm leading-6 text-muted-foreground">
              Asked by{" "}
              <Link
                className="font-medium text-foreground underline-offset-4 hover:underline"
                to={`/${item.asker.username}`}
              >
                {item.asker.displayName}
                <span className="font-mono text-xs text-muted-foreground">
                  {" "}
                  @{item.asker.username}
                </span>
              </Link>
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
          <Button asChild size="sm" variant="secondary">
            <Link
              defaultShouldRevalidate={false}
              id={threadHref.focusReturnId}
              mask={threadHref.mask}
              prefetch="intent"
              preventScrollReset
              to={threadHref.to}
            >
              <MessageCircle data-icon="inline-start" />
              Thread
            </Link>
          </Button>
        </div>
      </footer>
    </article>
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
  return createThreadModalLink({
    location,
    threadPublicId,
    username: ownerUsername,
  });
}
