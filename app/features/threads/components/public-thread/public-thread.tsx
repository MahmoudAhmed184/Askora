import { LockKeyhole, Pin, Send } from "lucide-react";
import { Link } from "react-router";

import type { AppShellData } from "~/types/app-shell-data";
import { AppShell } from "~/components/layout/app-shell/app-shell";
import { PublicShell } from "~/components/layout/public-shell/public-shell";
import { EditedQuestionBadge } from "~/components/shared/edited-question-badge/edited-question-badge";
import { HiddenQuestionPlaceholder } from "~/components/shared/hidden-question-placeholder";
import {
  AnonymousAvatar,
  ProfileAvatar,
  ProfileIdentityLink,
} from "~/components/shared/profile-identity/profile-identity";
import { UnavailableState } from "~/components/shared/unavailable-state/unavailable-state";
import { Button } from "~/components/ui/button/button";
import { PublishedAnswerActions } from "~/features/answers/components/published-answer-actions";
import { BetaNoindexBadge } from "~/features/profiles/components/profile-header";
import { FollowButton } from "~/features/social/components/follow-button";
import { LikeButton } from "~/features/social/components/like-button";
import { PublicReportDialog } from "~/features/moderation/components/public-report-dialog";
import { ThreadFollowUpComposer } from "~/features/threads/components/thread-follow-up-composer";
import type { ThreadModalData } from "~/features/threads/thread-modal";
import type {
  PublicThreadAnswerItem,
  PublicThreadItem,
  PublicThreadPageData,
  PublicThreadProfileView,
  PublicThreadRemovedItem,
} from "~/features/threads/types/threads.types";
import { formatMediumDateTime } from "~/lib/date-format";
import { cn } from "~/lib/utils";

interface PublicThreadProps {
  betaNoindex: boolean;
  page: PublicThreadPageData;
  shell?: AppShellData | undefined;
}

export function PublicThread({ betaNoindex, page, shell }: PublicThreadProps) {
  const content = (
    <PublicThreadPageContent betaNoindex={betaNoindex} page={page} />
  );

  if (shell !== undefined) {
    return <AppShell>{content}</AppShell>;
  }

  return <PublicShell>{content}</PublicShell>;
}

export function PublicThreadModalContent({
  modal,
}: {
  modal: ThreadModalData;
}) {
  const { page } = modal;

  if (page.status === "unavailable") {
    return <UnavailablePublicThread page={page} />;
  }

  return (
    <PublicThreadCard
      followUpTimingToken={
        modal.followUpComposer.status === "available"
          ? modal.followUpComposer.timingToken
          : undefined
      }
      inlineFollowUp
      page={page}
    />
  );
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
      {betaNoindex ? (
        <div className="flex justify-end">
          <BetaNoindexBadge />
        </div>
      ) : null}

      <PublicThreadCard page={page} />
    </div>
  );
}

function PublicThreadCard({
  followUpTimingToken,
  inlineFollowUp = false,
  page,
}: {
  page: Extract<PublicThreadPageData, { status: "available" }>;
  inlineFollowUp?: boolean | undefined;
  followUpTimingToken?: string | undefined;
}) {
  const answerCount = page.items.filter(isAnswerItem).length;

  return (
    <section className="overflow-hidden rounded-3xl border bg-card text-card-foreground shadow-[var(--shadow-card)]">
      <PublicThreadHeader
        answerCount={answerCount}
        canReport={page.canReport}
        follow={page.follow}
        profile={page.profile}
        publishedAt={page.thread.publishedAt}
        reserveCloseSpace={inlineFollowUp}
      />
      <ol
        aria-label={getAnswerCountLabel(answerCount)}
        className="flex list-none flex-col border-t border-dashed px-6 sm:px-7"
      >
        {page.items.map((item, index) => (
          <li
            className="border-b border-dashed py-6 last:border-b-0"
            key={getThreadItemKey(item, index)}
          >
            <PublicThreadItemCard
              canReport={page.canReport}
              controls={page.publishedAnswerControls}
              index={index}
              item={item}
              profile={page.profile}
            />
          </li>
        ))}
      </ol>
      <PublicThreadFollowUpPanel
        followUp={page.followUp}
        inline={inlineFollowUp}
        profile={page.profile}
        threadPublicId={page.thread.publicId}
        timingToken={followUpTimingToken}
      />
    </section>
  );
}

function PublicThreadFollowUpPanel({
  followUp,
  inline,
  profile,
  threadPublicId,
  timingToken,
}: {
  followUp: Extract<PublicThreadPageData, { status: "available" }>["followUp"];
  inline: boolean;
  profile: PublicThreadProfileView;
  threadPublicId: string;
  timingToken: string | undefined;
}) {
  if (followUp.status === "allowed") {
    if (inline) {
      if (timingToken === undefined) {
        throw new Error("Inline follow-up composer requires a timing token.");
      }

      return (
        <footer className="border-t border-dashed px-6 py-6 sm:px-7">
          <ThreadFollowUpComposer
            followUp={followUp}
            profile={profile}
            threadPublicId={threadPublicId}
            timingToken={timingToken}
          />
        </footer>
      );
    }

    return (
      <footer className="border-t border-dashed px-6 py-6 sm:px-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-bold text-foreground">
              Follow-up question
            </h2>
            <p className="text-sm leading-6 text-muted-foreground">
              Follow-ups go to @{profile.username}'s private inbox.
            </p>
          </div>
          <Button asChild className="justify-center px-6">
            <Link to={`/${profile.username}/a/${threadPublicId}/follow-ups`}>
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
        <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
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
    <UnavailableState
      description="The answer thread may have been removed, unpublished, or made unavailable by the profile owner."
      meta={`@${page.username}`}
      title="This thread is unavailable"
    />
  );
}

function PublicThreadHeader({
  answerCount,
  canReport,
  follow,
  profile,
  publishedAt,
  reserveCloseSpace,
}: {
  answerCount: number;
  canReport: boolean;
  follow: Extract<PublicThreadPageData, { status: "available" }>["follow"];
  profile: PublicThreadProfileView;
  publishedAt: string;
  reserveCloseSpace: boolean;
}) {
  return (
    <header
      className={cn(
        "flex flex-col gap-3 px-6 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-7 sm:py-6",
        reserveCloseSpace && "pr-20 sm:pr-20",
      )}
    >
      <ProfileIdentityLink
        meta={
          <>
            <span aria-hidden="true">·</span>
            <time dateTime={publishedAt}>{formatDate(publishedAt)}</time>
            <span aria-hidden="true">·</span>
            <h2 className="font-mono text-xs font-semibold text-primary">
              {getAnswerCountLabel(answerCount)}
            </h2>
          </>
        }
        profile={profile}
      />
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <FollowButton follow={follow} />
        <PublicReportDialog
          canReport={canReport}
          targetId={profile.username}
          targetLabel="profile"
          targetType="profile"
        />
      </div>
    </header>
  );
}

function PublicThreadItemCard({
  canReport,
  controls,
  index,
  item,
  profile,
}: {
  canReport: boolean;
  controls: Extract<
    PublicThreadPageData,
    { status: "available" }
  >["publishedAnswerControls"];
  index: number;
  item: PublicThreadItem;
  profile: PublicThreadProfileView;
}) {
  if (item.type === "removed") {
    return <RemovedThreadItem item={item} />;
  }

  return (
    <AnswerThreadItem
      canReport={canReport}
      controls={controls}
      index={index}
      item={item}
      profile={profile}
    />
  );
}

function AnswerThreadItem({
  canReport,
  controls,
  index,
  item,
  profile,
}: {
  canReport: boolean;
  controls: Extract<
    PublicThreadPageData,
    { status: "available" }
  >["publishedAnswerControls"];
  index: number;
  item: PublicThreadAnswerItem;
  profile: PublicThreadProfileView;
}) {
  return (
    <article className="scroll-mt-24" id={`item-${item.publicId}`}>
      <div className="flex flex-col gap-5">
        {item.questionTextMode === "hidden" ? (
          <HiddenQuestionPlaceholder />
        ) : item.questionText === undefined ? undefined : (
          <ThreadQuestionEntry
            index={index}
            item={item}
            time={formatDate(item.publishedAt)}
          />
        )}
        <ThreadAnswerEntry
          body={item.answerText}
          index={index}
          profile={profile}
          time={formatDate(item.publishedAt)}
        />
      </div>

      <footer className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <LikeButton like={item.like} />
          {item.pinPosition === null ? undefined : (
            <span className="inline-flex h-9 items-center gap-2 rounded-full border bg-background px-3.5 text-sm font-semibold text-foreground">
              <Pin data-icon="inline-start" />
              Pinned {item.pinPosition}
            </span>
          )}
        </div>

        <PublishedAnswerActions
          answer={item}
          canReport={canReport}
          controls={controls}
        />
      </footer>
    </article>
  );
}

function ThreadQuestionEntry({
  index,
  item,
  time,
}: {
  index: number;
  item: PublicThreadAnswerItem;
  time: string;
}) {
  return (
    <div className="flex gap-3">
      <ThreadAskerAvatar asker={item.asker} />
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <ThreadEntryBadge
            label={index === 0 ? "Question" : "Follow-up"}
            tone="question"
          />
          <ThreadAskerAttribution asker={item.asker} />
          <span className="whitespace-nowrap font-mono text-[0.72rem] text-muted-foreground">
            <span aria-hidden="true">· </span>
            {time}
          </span>
        </div>
        <div className="flex flex-wrap items-baseline gap-2">
          <p
            className={cn(
              "min-w-0 flex-1 whitespace-pre-wrap break-words font-serif font-bold italic",
              index === 0
                ? "text-2xl leading-tight text-primary"
                : "text-lg leading-7 text-foreground",
            )}
          >
            {item.questionText}
          </p>
          {item.questionTextMode === "edited" ? (
            <EditedQuestionBadge />
          ) : undefined}
        </div>
      </div>
    </div>
  );
}

function ThreadAnswerEntry({
  body,
  index,
  profile,
  time,
}: {
  body: string;
  index: number;
  profile: PublicThreadProfileView;
  time: string;
}) {
  return (
    <div className="flex gap-3">
      <Link
        aria-label={`View ${profile.displayName}'s profile`}
        className="shrink-0 rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/35"
        to={`/${profile.username}`}
      >
        <ProfileAvatar profile={profile} size="sm" />
      </Link>
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <ThreadEntryBadge
            label={index === 0 ? "Answer" : "Follow-up answer"}
            tone="answer"
          />
          <Link
            className="font-medium text-foreground underline-offset-4 hover:underline"
            to={`/${profile.username}`}
          >
            {profile.displayName}
          </Link>
          <span className="whitespace-nowrap font-mono text-[0.72rem] text-muted-foreground">
            <span aria-hidden="true">· </span>
            {time}
          </span>
        </div>
        <p className="whitespace-pre-wrap break-words text-[0.96rem] leading-8 text-foreground/90 sm:text-base">
          {body}
        </p>
      </div>
    </div>
  );
}

function ThreadAskerAttribution({
  asker,
}: {
  asker: PublicThreadAnswerItem["asker"];
}) {
  if (asker === undefined) {
    return <span className="font-medium text-muted-foreground">Anonymous</span>;
  }

  return (
    <Link
      className="font-medium text-foreground underline-offset-4 hover:underline"
      to={`/${asker.username}`}
    >
      {asker.displayName}{" "}
      <span className="font-mono text-xs text-muted-foreground">
        @{asker.username}
      </span>
    </Link>
  );
}

function ThreadEntryBadge({
  label,
  tone,
}: {
  label: string;
  tone: "question" | "answer";
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[0.7rem] font-bold uppercase tracking-[0.06em]",
        tone === "question"
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-border bg-secondary text-secondary-foreground",
      )}
      data-slot="thread-entry-badge"
    >
      {label}
    </span>
  );
}

function ThreadAskerAvatar({
  asker,
}: {
  asker: PublicThreadAnswerItem["asker"];
}) {
  if (asker === undefined) {
    return <AnonymousAvatar size="sm" />;
  }

  return (
    <Link
      aria-label={`View ${asker.displayName}'s profile`}
      className="shrink-0 rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/35"
      to={`/${asker.username}`}
    >
      <ProfileAvatar profile={asker} size="sm" />
    </Link>
  );
}

function RemovedThreadItem({ item }: { item: PublicThreadRemovedItem }) {
  return (
    <div
      aria-label="Answer removed"
      className="flex flex-wrap items-center gap-3 rounded-2xl bg-destructive/5 px-4 py-3 text-sm text-muted-foreground"
      data-position={item.position}
    >
      <span className="rounded-full border border-destructive/35 bg-background px-3 py-1 font-medium text-destructive">
        Answer removed
      </span>
      <span>This item was removed. The thread order is preserved.</span>
    </div>
  );
}

function getAnswerCountLabel(answerCount: number) {
  return `${String(answerCount)} ${answerCount === 1 ? "answer" : "answers"}`;
}

function isAnswerItem(item: PublicThreadItem): item is PublicThreadAnswerItem {
  return item.type === "answer";
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
