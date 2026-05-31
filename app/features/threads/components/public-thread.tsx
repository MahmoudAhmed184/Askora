import { LockKeyhole, Pin, Send } from "lucide-react";
import { Link } from "react-router";

import { PublicShell } from "~/components/app/public-shell";
import { Button } from "~/components/ui/button";
import { PublishedAnswerOwnerControls } from "~/features/answers/components/published-answer-owner-controls";
import { BetaNoindexBadge } from "~/features/profiles/components/profile-header";
import { FollowButton } from "~/features/social/components/follow-button";
import { LikeButton } from "~/features/social/components/like-button";
import type {
  PublicThreadAnswerItem,
  PublicThreadItem,
  PublicThreadPageData,
  PublicThreadProfileView,
  PublicThreadRemovedItem,
} from "~/features/threads/public-thread.loader.server";

interface PublicThreadProps {
  betaNoindex: boolean;
  page: PublicThreadPageData;
}

export function PublicThread({ betaNoindex, page }: PublicThreadProps) {
  if (page.status === "unavailable") {
    return <UnavailablePublicThread page={page} />;
  }

  return (
    <PublicShell>
      <div className="flex flex-col gap-6">
        <div className="flex justify-end">
          {betaNoindex ? <BetaNoindexBadge /> : null}
        </div>
        <PublicThreadHeader
          follow={page.follow}
          profile={page.profile}
          publishedAt={page.thread.publishedAt}
        />
        <PublicThreadFollowUpCallout
          followUp={page.followUp}
          profileUsername={page.profile.username}
          threadPublicId={page.thread.publicId}
        />
        <section
          aria-labelledby="thread-answers-title"
          className="flex flex-col gap-3"
        >
          <h2 className="sr-only" id="thread-answers-title">
            Thread answers
          </h2>
          <div className="flex flex-col gap-3">
            {page.items.map((item, index) => (
              <PublicThreadItemCard
                controls={page.publishedAnswerControls}
                item={item}
                key={getThreadItemKey(item, index)}
              />
            ))}
          </div>
        </section>
      </div>
    </PublicShell>
  );
}

function PublicThreadFollowUpCallout({
  followUp,
  profileUsername,
  threadPublicId,
}: {
  followUp: Extract<PublicThreadPageData, { status: "available" }>["followUp"];
  profileUsername: string;
  threadPublicId: string;
}) {
  if (followUp.status === "allowed") {
    return (
      <section className="flex flex-col items-start gap-3 rounded-lg border bg-card p-5 text-card-foreground">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">Have a follow-up?</h2>
          <p className="max-w-prose text-sm leading-6 text-muted-foreground">
            {followUp.description}
          </p>
        </div>
        <Button asChild>
          <Link to={`/${profileUsername}/a/${threadPublicId}/follow-ups`}>
            <Send data-icon="inline-start" />
            Ask a follow-up
          </Link>
        </Button>
      </section>
    );
  }

  return (
    <section className="flex flex-col items-start gap-3 rounded-lg border border-dashed bg-background p-5">
      <div className="flex flex-col gap-1">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <LockKeyhole aria-hidden="true" className="size-4" />
          Follow-ups unavailable
        </h2>
        <p className="max-w-prose text-sm leading-6 text-muted-foreground">
          {followUp.message}
        </p>
      </div>
      {followUp.action === undefined ? null : (
        <Button asChild variant="outline">
          <Link to={followUp.action.href}>{followUp.action.label}</Link>
        </Button>
      )}
    </section>
  );
}

function UnavailablePublicThread({
  page,
}: {
  page: Extract<PublicThreadPageData, { status: "unavailable" }>;
}) {
  return (
    <PublicShell>
      <section className="mx-auto flex min-h-[50svh] max-w-xl flex-col justify-center gap-3 py-10">
        <p className="break-all text-sm font-medium text-muted-foreground">
          @{page.username}
        </p>
        <h1 className="text-3xl font-semibold leading-tight">
          This thread is unavailable
        </h1>
        <p className="text-sm leading-6 text-muted-foreground">
          The answer thread may have been removed, unpublished, or made
          unavailable by the profile owner.
        </p>
      </section>
    </PublicShell>
  );
}

function PublicThreadHeader({
  follow,
  profile,
  publishedAt,
}: {
  follow: Extract<PublicThreadPageData, { status: "available" }>["follow"];
  profile: PublicThreadProfileView;
  publishedAt: string;
}) {
  return (
    <header className="flex flex-col gap-5 border-b pb-6 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 gap-4">
        <ProfileAvatar profile={profile} />
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-col gap-1">
            <h1 className="break-words text-3xl font-semibold leading-tight sm:text-4xl">
              Answer thread
            </h1>
            <p className="break-words text-sm leading-6 text-muted-foreground">
              Published by{" "}
              <Link
                className="font-medium text-foreground underline-offset-4 hover:underline"
                to={`/${profile.username}`}
              >
                {profile.displayName} (@{profile.username})
              </Link>
            </p>
          </div>
        </div>
      </div>
      <div className="flex flex-col items-start gap-3 sm:items-end">
        <time
          className="text-sm leading-6 text-muted-foreground sm:text-right"
          dateTime={publishedAt}
        >
          {formatDate(publishedAt)}
        </time>
        <FollowButton follow={follow} />
      </div>
    </header>
  );
}

function ProfileAvatar({ profile }: { profile: PublicThreadProfileView }) {
  if (profile.avatarUrl !== null) {
    return (
      <img
        alt=""
        className="size-16 shrink-0 rounded-lg border bg-muted object-cover"
        src={profile.avatarUrl}
      />
    );
  }

  return (
    <span className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-primary text-2xl font-semibold text-primary-foreground">
      {profile.displayName.slice(0, 1).toUpperCase()}
    </span>
  );
}

function PublicThreadItemCard({
  controls,
  item,
}: {
  controls: Extract<PublicThreadPageData, { status: "available" }>["publishedAnswerControls"];
  item: PublicThreadItem;
}) {
  if (item.type === "removed") {
    return <RemovedThreadItem item={item} />;
  }

  return <AnswerThreadItem controls={controls} item={item} />;
}

function AnswerThreadItem({
  controls,
  item,
}: {
  controls: Extract<PublicThreadPageData, { status: "available" }>["publishedAnswerControls"];
  item: PublicThreadAnswerItem;
}) {
  return (
    <article
      className="flex flex-col gap-4 rounded-lg border bg-card p-5 text-card-foreground shadow-sm"
      id={`item-${item.publicId}`}
    >
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {item.pinPosition === null ? undefined : (
            <span className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium text-foreground">
              <Pin aria-hidden="true" className="size-3" />
              Pinned {item.pinPosition}
            </span>
          )}
          <time dateTime={item.publishedAt}>{formatDate(item.publishedAt)}</time>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <LikeButton like={item.like} />
          {controls.canManage ? (
            <PublishedAnswerOwnerControls answer={item} controls={controls} />
          ) : undefined}
        </div>
      </header>

      {item.questionText === undefined ? undefined : (
        <div className="flex flex-col gap-2 border-b pb-4">
          <p className="whitespace-pre-wrap break-words text-base font-medium leading-7">
            {item.questionText}
          </p>
          {item.asker === undefined ? undefined : (
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
    </article>
  );
}

function RemovedThreadItem({ item }: { item: PublicThreadRemovedItem }) {
  return (
    <div
      aria-label="Answer removed"
      className="rounded-lg border border-dashed bg-muted/30 px-5 py-4 text-sm font-medium text-muted-foreground"
      data-position={item.position}
    >
      Answer removed
    </div>
  );
}

function getThreadItemKey(item: PublicThreadItem, index: number) {
  if (item.type === "answer") {
    return item.publicId;
  }

  return `removed-${String(item.position)}-${String(index)}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
