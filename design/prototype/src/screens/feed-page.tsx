import * as React from "react";
import { Heart, MessageCircle } from "lucide-react";

import { GeminiNotification } from "../components/notifications/gemini-notification";
import { Button } from "../components/ui/button";
import { cn } from "../lib/utils";

type ToastState = {
  message: string;
  tone: "danger" | "success";
};

type FeedItem = {
  answer: string;
  author: string;
  handle: string;
  id: string;
  initials: string;
  likes: number;
  question: string;
  thread: string;
  time: string;
};

const feedItems = [
  {
    answer:
      "Low-contrast typography often pretends to be minimalism. If a reader has to squint, the design has already failed at communication.",
    author: "Alex Leyton",
    handle: "@alexl",
    id: "feed-alex-contrast",
    initials: "AL",
    likes: 1204,
    question: "What design trend do you actively avoid?",
    thread: "45 follow-ups",
    time: "Today, 9:12 AM",
  },
  {
    answer:
      "Only if you build other pillars. If work is the only domain where you seek excellence, your identity will naturally over-attach to it.",
    author: "Sarah Miller",
    handle: "@sarahm",
    id: "feed-sarah-work",
    initials: "SM",
    likes: 892,
    question: "Is it possible to decouple your identity from your profession?",
    thread: "31 follow-ups",
    time: "Yesterday, 6:30 PM",
  },
  {
    answer:
      "The easiest reset is to stop trying to make the draft useful. Private notes let messy first thoughts arrive before the audience edits them away.",
    author: "Maya Chen",
    handle: "@mayachen",
    id: "feed-maya-reset",
    initials: "MC",
    likes: 301,
    question: "How do you reset after a public answer does too well?",
    thread: "8 follow-ups",
    time: "Yesterday, 1:10 PM",
  },
] as const satisfies readonly FeedItem[];

export function FeedPage() {
  const [toast, setToast] = React.useState<ToastState | null>(null);
  const [visibleFeedCount, setVisibleFeedCount] = React.useState(2);
  const [likedIds, setLikedIds] = React.useState<ReadonlySet<string>>(
    () => new Set(),
  );

  React.useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setToast(null);
    }, 2600);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [toast]);

  function triggerToast(message: string, tone: ToastState["tone"] = "success") {
    setToast({ message, tone });
  }

  function toggleLike(itemId: string) {
    setLikedIds((current) => {
      const next = new Set(current);

      if (next.has(itemId)) {
        next.delete(itemId);
        triggerToast("Like removed.");
      } else {
        next.add(itemId);
        triggerToast("Feed item liked.");
      }

      return next;
    });
  }

  const visibleItems = feedItems.slice(0, visibleFeedCount);

  return (
    <div className="gemini-profile">
      <main className="gemini-app-shell" role="main">
        <section
          aria-label="Following feed"
          className="gemini-feed-container mx-auto max-w-3xl"
        >
          <div>
            <h1 className="gemini-feed-title">
              Following Feed <span>Chronological</span>
            </h1>
            <p className="text-sm leading-6 text-muted-foreground">
              Newest published answers from followed profiles only.
            </p>
          </div>

          {visibleItems.map((item) => (
            <FeedArticle
              isLiked={likedIds.has(item.id)}
              item={item}
              key={item.id}
              onOpenThread={() => {
                triggerToast(`Opened ${item.author}'s thread.`);
              }}
              onToggleLike={() => {
                toggleLike(item.id);
              }}
            />
          ))}

          <div className="flex justify-center">
            <Button
              disabled={visibleFeedCount >= feedItems.length}
              onClick={() => {
                setVisibleFeedCount(feedItems.length);
                triggerToast("More followed posts loaded.");
              }}
              type="button"
              variant="outline"
            >
              Load more
            </Button>
          </div>
        </section>
      </main>

      <GeminiNotification
        message={toast?.message ?? ""}
        open={Boolean(toast)}
        tone={toast?.tone ?? "success"}
      />
    </div>
  );
}

function FeedArticle({
  isLiked,
  item,
  onOpenThread,
  onToggleLike,
}: {
  isLiked: boolean;
  item: FeedItem;
  onOpenThread: () => void;
  onToggleLike: () => void;
}) {
  return (
    <article className="gemini-content-card">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-secondary font-serif text-sm font-bold text-primary">
          {item.initials}
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-foreground">{item.author}</h2>
          <p className="truncate font-mono text-[0.68rem] text-muted-foreground">
            {item.handle} · {item.time}
          </p>
        </div>
      </div>
      <h3 className="gemini-q-text">"{item.question}"</h3>
      <p className="mt-4 text-sm leading-7 text-foreground/90">{item.answer}</p>
      <footer className="mt-5 flex flex-col gap-3 border-t border-dashed border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-4">
          <button
            aria-pressed={isLiked}
            className={cn("gemini-heart-btn", isLiked && "liked")}
            onClick={onToggleLike}
            type="button"
          >
            <Heart data-icon="inline-start" />
            {item.likes + (isLiked ? 1 : 0)}
          </button>
          <span className="gemini-heart-btn">
            <MessageCircle data-icon="inline-start" />
            {item.thread}
          </span>
        </div>
        <Button onClick={onOpenThread} size="sm" type="button" variant="link">
          Read thread
        </Button>
      </footer>
    </article>
  );
}
