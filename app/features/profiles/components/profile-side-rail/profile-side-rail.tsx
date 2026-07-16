import { Pin } from "lucide-react";
import { Link, useLocation } from "react-router";

import type { PublicPublishedAnswer } from "~/features/answers/types/answers.types";
import type { PublicProfileView } from "~/features/profiles/types/profiles.types";
import { createThreadModalLink } from "~/features/threads/thread-modal";

interface ProfileSideRailProps {
  answers: PublicPublishedAnswer[];
  profile: PublicProfileView;
}

export function ProfileSideRail({
  answers,
  profile,
}: ProfileSideRailProps) {
  const pinnedAnswers = answers
    .filter((answer) => answer.pinPosition !== null)
    .sort((left, right) => (left.pinPosition ?? 0) - (right.pinPosition ?? 0))
    .slice(0, 3);

  if (pinnedAnswers.length === 0) {
    return null;
  }

  return (
    <aside className="flex flex-col gap-6 lg:sticky lg:top-10">
      <PinnedThreadsPanel answers={pinnedAnswers} profile={profile} />
    </aside>
  );
}

function PinnedThreadsPanel({
  answers,
  profile,
}: {
  answers: PublicPublishedAnswer[];
  profile: PublicProfileView;
}) {
  const location = useLocation();

  return (
    <section className="rounded-3xl border bg-card p-5 text-card-foreground shadow-[var(--shadow-card)] sm:p-6">
      <div className="flex items-center gap-2">
        <Pin aria-hidden="true" className="size-4 text-primary" />
        <h2 className="font-serif text-xl font-bold text-foreground">
          Pinned Threads
        </h2>
      </div>
      {answers.length === 0 ? (
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          No pinned threads yet.
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {answers.map((answer) => (
            <PinnedThreadLink
              answer={answer}
              key={answer.publicId}
              link={createThreadHref({
                location,
                profileUsername: profile.username,
                threadPublicId: answer.threadPublicId,
              })}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function PinnedThreadLink({
  answer,
  link,
}: {
  answer: PublicPublishedAnswer;
  link: ReturnType<typeof createThreadHref>;
}) {
  return (
    <Link
      className="group rounded-xl border border-transparent p-1.5 transition-[border-color,background-color] duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-border hover:bg-secondary/70"
      defaultShouldRevalidate={false}
      id={link.focusReturnId}
      mask={link.mask}
      prefetch="intent"
      preventScrollReset
      to={link.to}
    >
      <h3 className="line-clamp-2 text-sm font-bold leading-5 text-primary group-hover:underline">
        {getPinnedThreadTitle(answer)}
      </h3>
      <p className="mt-1 font-mono text-[0.68rem] text-muted-foreground">
        {formatPinnedThreadMeta(answer)}
      </p>
    </Link>
  );
}

function getPinnedThreadTitle(answer: PublicPublishedAnswer) {
  return answer.questionText ?? answer.answerText.split(/\s+/).slice(0, 10).join(" ");
}

function formatPinnedThreadMeta(answer: PublicPublishedAnswer) {
  const responseLabel = answer.like.count === 1 ? "reaction" : "reactions";

  if (answer.like.count === undefined) {
    return `Updated ${formatRelativeDate(answer.publishedAt)}`;
  }

  return `${String(answer.like.count)} ${responseLabel} · Updated ${formatRelativeDate(answer.publishedAt)}`;
}

function formatRelativeDate(value: string) {
  const publishedAt = new Date(value);
  const now = new Date();
  const diffMs = now.getTime() - publishedAt.getTime();
  const diffDays = Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)));

  if (diffDays === 0) {
    return "today";
  }

  if (diffDays === 1) {
    return "yesterday";
  }

  return `${String(diffDays)} days ago`;
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
