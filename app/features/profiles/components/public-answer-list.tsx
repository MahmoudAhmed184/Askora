import { Pin } from "lucide-react";
import { Link } from "react-router";

import { EmptyState } from "~/components/app/empty-state";
import type { PublicPublishedAnswer } from "~/features/answers/answer.server";
import { PublishedAnswerOwnerControls } from "~/features/answers/components/published-answer-owner-controls";
import {
  hiddenPublishedAnswerControls,
  type PublishedAnswerControlState,
} from "~/features/answers/published-answer-controls";
import { LikeButton } from "~/features/social/components/like-button";

interface PublicAnswerListProps {
  answers: PublicPublishedAnswer[];
  controls?: PublishedAnswerControlState;
  profileUsername: string;
}

export function PublicAnswerList({
  answers,
  controls = hiddenPublishedAnswerControls,
  profileUsername,
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
      className="flex flex-col gap-3 pt-2"
      id="published-answers"
    >
      <h2 className="text-lg font-semibold" id="published-answers-title">
        Published answers
      </h2>
      <div className="flex flex-col gap-3">
        {answers.map((answer) => (
          <PublicAnswerArticle
            answer={answer}
            controls={controls}
            key={answer.publicId}
            profileUsername={profileUsername}
          />
        ))}
      </div>
    </section>
  );
}

function PublicAnswerArticle({
  answer,
  controls,
  profileUsername,
}: {
  answer: PublicPublishedAnswer;
  controls: PublishedAnswerControlState;
  profileUsername: string;
}) {
  return (
    <article className="flex flex-col gap-4 rounded-lg border bg-card p-5 text-card-foreground shadow-sm">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {answer.pinPosition === null ? undefined : (
            <span className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium text-foreground">
              <Pin aria-hidden="true" className="size-3" />
              Pinned {answer.pinPosition}
            </span>
          )}
          <time dateTime={answer.publishedAt}>
            {formatDate(answer.publishedAt)}
          </time>
          <Link
            className="font-medium text-foreground underline-offset-4 hover:underline"
            to={`/${profileUsername}/a/${answer.threadPublicId}#item-${answer.publicId}`}
          >
            View thread
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <LikeButton like={answer.like} />
          {controls.canManage ? (
            <PublishedAnswerOwnerControls answer={answer} controls={controls} />
          ) : undefined}
        </div>
      </header>

      {answer.questionTextMode === "hidden" ||
      answer.questionText === null ? undefined : (
        <div className="flex flex-col gap-2 border-b pb-4">
          <p className="whitespace-pre-wrap break-words text-base font-medium leading-7">
            {answer.questionText}
          </p>
          {answer.asker === undefined ? undefined : (
            <p className="text-sm leading-6 text-muted-foreground">
              Asked by{" "}
              <span className="font-medium text-foreground">
                {answer.asker.displayName}
              </span>{" "}
              @{answer.asker.username}
            </p>
          )}
        </div>
      )}

      <p className="whitespace-pre-wrap break-words text-base leading-7">
        {answer.answerText}
      </p>
    </article>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
