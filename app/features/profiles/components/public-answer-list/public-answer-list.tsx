import { MessageCircle, Pin } from "lucide-react";
import { Link, useLocation } from "react-router";

import { EditedQuestionBadge } from "~/components/shared/edited-question-badge/edited-question-badge";
import { EmptyState } from "~/components/shared/empty-state/empty-state";
import { GeneratedQuestionBadge } from "~/components/shared/generated-question-badge";
import { HiddenQuestionPlaceholder } from "~/components/shared/hidden-question-placeholder";
import {
  ProfileIdentityLink,
  type ProfileIdentitySummary,
} from "~/components/shared/profile-identity/profile-identity";
import type { PublicPublishedAnswer } from "~/features/answers/types/answers.types";
import { PublishedAnswerActions } from "~/features/answers/components/published-answer-actions";
import {
  hiddenPublishedAnswerControls,
  type PublishedAnswerControlState,
} from "~/features/answers/published-answer-controls";
import { LikeButton } from "~/features/social/components/like-button";
import { createThreadModalLink } from "~/features/threads/thread-modal";
import { formatMediumDateTime } from "~/lib/date-format";

interface PublicAnswerListProps {
  answers: PublicPublishedAnswer[];
  canReport?: boolean | undefined;
  controls?: PublishedAnswerControlState;
  nextCursor?: string | undefined;
  profile: ProfileIdentitySummary;
}

export function PublicAnswerList({
  answers,
  canReport = false,
  controls = hiddenPublishedAnswerControls,
  nextCursor,
  profile,
}: PublicAnswerListProps) {
  if (answers.length === 0) {
    return (
      <section
        aria-labelledby="published-answers-title"
        className="pt-2"
        id="published-answers"
      >
        <h2 className="sr-only" id="published-answers-title">
          Published answers
        </h2>
        <EmptyState
          description="Answered questions will appear here once this profile publishes them."
          title="No public answers yet"
        />
      </section>
    );
  }

  return (
    <section
      aria-labelledby="published-answers-title"
      className="flex flex-col gap-4 pt-2"
      id="published-answers"
    >
      <h2
        className="flex items-center gap-2 font-serif text-xl font-bold text-foreground"
        id="published-answers-title"
      >
        Answers Feed
        <span className="rounded bg-secondary px-2 py-1 font-mono text-[0.68rem] font-semibold text-primary">
          Latest
        </span>
      </h2>
      <div className="flex flex-col gap-4">
        {answers.map((answer) => (
          <PublicAnswerArticle
            answer={answer}
            controls={controls}
            canReport={canReport}
            key={answer.publicId}
            profile={profile}
          />
        ))}
      </div>
      {nextCursor === undefined ? null : (
        <div className="flex justify-center pt-2">
          <Link
            className="inline-flex h-10 items-center justify-center rounded-full border bg-background px-5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30"
            to={`?answers=${encodeURIComponent(nextCursor)}#published-answers`}
          >
            Older answers
          </Link>
        </div>
      )}
    </section>
  );
}

function PublicAnswerArticle({
  answer,
  canReport,
  controls,
  profile,
}: {
  answer: PublicPublishedAnswer;
  canReport: boolean;
  controls: PublishedAnswerControlState;
  profile: ProfileIdentitySummary;
}) {
  const location = useLocation();
  const threadHref = createThreadHref({
    location,
    profileUsername: profile.username,
    threadPublicId: answer.threadPublicId,
  });

  return (
    <article className="flex flex-col gap-5 rounded-3xl border bg-card p-6 text-card-foreground shadow-[var(--shadow-card)] transition-[border-color] duration-[250ms] ease-[ease] hover:border-border-strong">
      <header className="flex items-start justify-between gap-3">
        <ProfileIdentityLink
          meta={
            <>
              <span aria-hidden="true">·</span>
              <time dateTime={answer.publishedAt}>
                {formatDate(answer.publishedAt)}
              </time>
              {answer.pinPosition === null ? undefined : (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1 font-medium text-foreground">
                    <Pin aria-hidden="true" className="size-3" />
                    Pinned {answer.pinPosition}
                  </span>
                </>
              )}
            </>
          }
          profile={profile}
        />

        <PublishedAnswerActions
          answer={answer}
          canReport={canReport}
          controls={controls}
        />
      </header>

      {answer.questionTextMode === "hidden" || answer.questionText === null ? (
        <div className="flex flex-col items-start gap-2 border-b border-dashed pb-5">
          <HiddenQuestionPlaceholder />
          {answer.ownerProvenance === "generated" ? (
            <GeneratedQuestionBadge />
          ) : undefined}
        </div>
      ) : (
        <div className="flex flex-col gap-2 border-b border-dashed pb-5">
          {answer.questionTextMode === "edited" ||
          answer.ownerProvenance === "generated" ? (
            <div className="flex flex-wrap items-center gap-2">
              {answer.questionTextMode === "edited" ? (
                <EditedQuestionBadge />
              ) : undefined}
              {answer.ownerProvenance === "generated" ? (
                <GeneratedQuestionBadge />
              ) : undefined}
            </div>
          ) : undefined}
          <div>
            <p
              className="whitespace-pre-wrap break-words font-serif text-xl font-bold italic leading-8 text-foreground"
              dir="auto"
            >
              {answer.questionText}
            </p>
          </div>
          {answer.asker === undefined ? undefined : (
            <p className="text-sm leading-6 text-muted-foreground">
              Asked by{" "}
              <Link
                className="font-medium text-foreground underline-offset-4 hover:underline"
                to={`/${answer.asker.username}`}
              >
                {answer.asker.displayName}
                <span className="font-mono text-xs text-muted-foreground">
                  {" "}
                  @{answer.asker.username}
                </span>
              </Link>
            </p>
          )}
        </div>
      )}

      <p className="whitespace-pre-wrap break-words text-[0.96rem] leading-8 text-foreground/85 sm:text-base">
        {answer.answerText}
      </p>

      <footer className="flex flex-wrap items-center gap-3 border-t border-dashed pt-4">
        <LikeButton like={answer.like} />
        <Link
          className="inline-flex h-9 items-center gap-2 rounded-full border bg-secondary px-3.5 text-sm font-semibold text-secondary-foreground transition-[border-color,background-color,box-shadow,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-px hover:border-primary/40 hover:bg-primary/10 hover:shadow-[0_4px_14px_var(--accent-glow)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
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
      </footer>
    </article>
  );
}

function formatDate(value: string) {
  return formatMediumDateTime(value);
}

function createThreadHref({
  location,
  profileUsername,
  threadPublicId,
}: {
  location: {
    hash: string;
    pathname: string;
    search: string;
  };
  profileUsername: string;
  threadPublicId: string;
}) {
  return createThreadModalLink({
    location,
    threadPublicId,
    username: profileUsername,
  });
}
