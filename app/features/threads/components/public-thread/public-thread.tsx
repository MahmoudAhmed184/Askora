import { LockKeyhole, MessageCircle, Pin, Send } from "lucide-react";
import { Link } from "react-router";

import type { AppShellData } from "~/types/app-shell-data";
import { AppShell } from "~/components/layout/app-shell/app-shell";
import { PublicShell } from "~/components/layout/public-shell/public-shell";
import { Button } from "~/components/ui/button/button";
import { Textarea } from "~/components/ui/textarea/textarea";
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
} from "~/features/threads/types/threads.types";
import { formatMediumDateTime } from "~/lib/date-format";

interface PublicThreadProps {
  betaNoindex: boolean;
  page: PublicThreadPageData;
  shell?: AppShellData | undefined;
}

export function PublicThread({
  betaNoindex,
  page,
  shell,
}: PublicThreadProps) {
  const content = (
    <PublicThreadPageContent betaNoindex={betaNoindex} page={page} />
  );

  if (shell !== undefined) {
    return <AppShell shell={shell}>{content}</AppShell>;
  }

  return <PublicShell>{content}</PublicShell>;
}

export function PublicThreadModalContent({
  page,
}: {
  page: PublicThreadPageData;
}) {
  if (page.status === "unavailable") {
    return <UnavailablePublicThread page={page} />;
  }

  return <PublicThreadCard page={page} />;
}

function PublicThreadPageContent({
  betaNoindex,
  page,
}: {
  betaNoindex: boolean;
  page: PublicThreadPageData;
}) {
  if (page.status === "unavailable") {
    return <UnavailablePublicThread page={page} />;
  }

  return <PublicThreadPage betaNoindex={betaNoindex} page={page} />;
}

function PublicThreadPage({
  betaNoindex,
  page,
}: {
  betaNoindex: boolean;
  page: Extract<PublicThreadPageData, { status: "available" }>;
}) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="flex items-center gap-2 font-serif text-xl font-bold text-foreground">
            Public Thread
            <span className="rounded bg-secondary px-2 py-1 font-mono text-[0.68rem] font-semibold text-primary">
              Preview
            </span>
          </h1>
          {betaNoindex ? <BetaNoindexBadge /> : null}
        </div>
        <p className="text-sm leading-6 text-muted-foreground">
          Published answers and follow-up state from @{page.profile.username}.
        </p>
      </header>

      <PublicThreadCard page={page} />
    </div>
  );
}

function PublicThreadCard({
  page,
}: {
  page: Extract<PublicThreadPageData, { status: "available" }>;
}) {
  return (
    <section className="overflow-hidden rounded-3xl border bg-card text-card-foreground shadow-[var(--shadow-card)]">
      <PublicThreadHeader
        follow={page.follow}
        itemCount={page.items.length}
        profile={page.profile}
        publishedAt={page.thread.publishedAt}
        threadPublicId={page.thread.publicId}
        title={getThreadTitle(page.items)}
      />
      <section
        aria-labelledby="thread-answers-title"
        className="flex flex-col gap-6 border-t border-dashed px-6 py-6 sm:px-7"
      >
        <h2 className="sr-only" id="thread-answers-title">
          Thread answers
        </h2>
        {page.items.map((item, index) => (
          <PublicThreadItemCard
            controls={page.publishedAnswerControls}
            index={index}
            item={item}
            key={getThreadItemKey(item, index)}
            profileDisplayName={page.profile.displayName}
          />
        ))}
      </section>
      <PublicThreadFollowUpPanel
        followUp={page.followUp}
        profileUsername={page.profile.username}
        threadPublicId={page.thread.publicId}
      />
    </section>
  );
}

function PublicThreadFollowUpPanel({
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
      <footer className="border-t border-dashed px-6 py-6 sm:px-7">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-foreground">
            Follow-up question
          </h2>
          <span className="font-mono text-[0.68rem] text-muted-foreground">
            Available
          </span>
        </div>
        <Textarea
          aria-label="Follow-up preview"
          className="min-h-24 resize-none rounded-xl bg-secondary p-4 placeholder:italic"
          placeholder="Ask a follow-up on this thread..."
          readOnly
          tabIndex={-1}
        />
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-mono text-[0.68rem] text-muted-foreground">
            0/500
          </span>
          <Button asChild className="justify-center px-6">
            <Link to={`/${profileUsername}/a/${threadPublicId}/follow-ups`}>
              <Send data-icon="inline-start" />
              Ask a follow-up
            </Link>
          </Button>
        </div>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {followUp.description}
        </p>
      </footer>
    );
  }

  return (
    <footer className="flex flex-col items-start gap-3 border-t border-dashed px-6 py-6 sm:px-7">
      <div className="flex flex-col gap-1">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <LockKeyhole data-icon="inline-start" />
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
    </footer>
  );
}

function UnavailablePublicThread({
  page,
}: {
  page: Extract<PublicThreadPageData, { status: "unavailable" }>;
}) {
  return (
    <section className="mx-auto flex min-h-[50svh] max-w-xl flex-col justify-center gap-3 py-10">
      <p className="break-all text-sm font-medium text-muted-foreground">
        @{page.username}
      </p>
      <h1 className="font-serif text-4xl font-bold leading-tight text-primary">
        This thread is unavailable
      </h1>
      <p className="text-sm leading-6 text-muted-foreground">
        The answer thread may have been removed, unpublished, or made
        unavailable by the profile owner.
      </p>
    </section>
  );
}

function PublicThreadHeader({
  follow,
  itemCount,
  profile,
  publishedAt,
  threadPublicId,
  title,
}: {
  follow: Extract<PublicThreadPageData, { status: "available" }>["follow"];
  itemCount: number;
  profile: PublicThreadProfileView;
  publishedAt: string;
  threadPublicId: string;
  title: string | undefined;
}) {
  return (
    <header className="flex flex-col gap-5 px-6 py-6 sm:px-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="break-all font-mono text-[0.72rem] text-muted-foreground">
            /{profile.username}/a/{threadPublicId}
          </p>
          {title === undefined ? null : (
            <h2 className="mt-3 max-w-3xl break-words font-serif text-2xl font-extrabold italic leading-tight text-primary">
              "{title}"
            </h2>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:max-w-56 sm:justify-end">
          <time
            className="font-mono text-[0.72rem] text-muted-foreground sm:text-right"
            dateTime={publishedAt}
          >
            {formatDate(publishedAt)}
          </time>
          <FollowButton follow={follow} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          className="rounded-full border bg-secondary px-3 py-1 text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          to={`/${profile.username}`}
        >
          {profile.displayName} @{profile.username}
        </Link>
        <span className="rounded-full border bg-secondary px-3 py-1 text-sm font-medium text-muted-foreground">
          {itemCount} {itemCount === 1 ? "item" : "items"}
        </span>
      </div>
    </header>
  );
}

function PublicThreadItemCard({
  controls,
  index,
  item,
  profileDisplayName,
}: {
  controls: Extract<PublicThreadPageData, { status: "available" }>["publishedAnswerControls"];
  index: number;
  item: PublicThreadItem;
  profileDisplayName: string;
}) {
  if (item.type === "removed") {
    return <RemovedThreadItem item={item} />;
  }

  return (
    <AnswerThreadItem
      controls={controls}
      index={index}
      item={item}
      profileDisplayName={profileDisplayName}
    />
  );
}

function AnswerThreadItem({
  controls,
  index,
  item,
  profileDisplayName,
}: {
  controls: Extract<PublicThreadPageData, { status: "available" }>["publishedAnswerControls"];
  index: number;
  item: PublicThreadAnswerItem;
  profileDisplayName: string;
}) {
  return (
    <article
      className="scroll-mt-24"
      id={`item-${item.publicId}`}
    >
      <div className="border-y border-dashed py-4">
        {item.questionText === undefined ? undefined : (
          <ThreadEvent
            actor={getQuestionActor(item)}
            body={item.questionText}
            kind={index === 0 ? "Question" : "Follow-up"}
            time={formatDate(item.publishedAt)}
          />
        )}
        <ThreadEvent
          actor={profileDisplayName}
          body={item.answerText}
          kind="Answer"
          time={formatDate(item.publishedAt)}
        />
      </div>

      <footer className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <LikeButton like={item.like} />
          <span className="inline-flex h-9 items-center gap-2 rounded-full border bg-secondary px-3.5 text-sm font-semibold text-secondary-foreground">
            <MessageCircle data-icon="inline-start" />
            {index === 0 ? "Original answer" : "Follow-up answer"}
          </span>
          {item.pinPosition === null ? undefined : (
            <span className="inline-flex h-9 items-center gap-2 rounded-full border bg-background px-3.5 text-sm font-semibold text-foreground">
              <Pin data-icon="inline-start" />
              Pinned {item.pinPosition}
            </span>
          )}
        </div>

        {controls.canManage ? (
          <PublishedAnswerOwnerControls answer={item} controls={controls} />
        ) : undefined}
      </footer>
    </article>
  );
}

function ThreadEvent({
  actor,
  body,
  kind,
  time,
}: {
  actor: string;
  body: string;
  kind: string;
  time: string;
}) {
  return (
    <div className="mb-4 last:mb-0">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[0.68rem] font-bold text-primary">
          {kind}
        </span>
        <span className="font-mono text-[0.72rem] text-muted-foreground">
          {actor} · {time}
        </span>
      </div>
      <p className="whitespace-pre-wrap break-words text-sm leading-7 text-foreground/90">
        {body}
      </p>
    </div>
  );
}

function getQuestionActor(item: PublicThreadAnswerItem) {
  if (item.asker === undefined) {
    return "Anonymous";
  }

  return `${item.asker.displayName} @${item.asker.username}`;
}

function RemovedThreadItem({ item }: { item: PublicThreadRemovedItem }) {
  return (
    <div
      aria-label="Answer removed"
      className="flex flex-wrap items-center gap-3 bg-destructive/5 px-5 py-4 text-sm text-muted-foreground sm:px-7"
      data-position={item.position}
    >
      <span className="rounded-full border border-destructive/35 bg-background px-3 py-1 font-medium text-destructive">
        Answer removed
      </span>
      <span>This item was removed. The thread order is preserved.</span>
    </div>
  );
}

function getThreadTitle(items: readonly PublicThreadItem[]) {
  return items.find(
    (item): item is PublicThreadAnswerItem =>
      item.type === "answer" && item.questionText !== undefined,
  )?.questionText;
}

function getThreadItemKey(item: PublicThreadItem, index: number) {
  if (item.type === "answer") {
    return item.publicId;
  }

  return `removed-${String(item.position)}-${String(index)}`;
}

function formatDate(value: string) {
  return formatMediumDateTime(value);
}
