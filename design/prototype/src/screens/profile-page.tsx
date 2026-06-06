import * as React from "react";
import { Heart, Mail, Plus, Send, Share2 } from "lucide-react";

import { GeminiNotification } from "../components/notifications/gemini-notification";
import { cn } from "../lib/utils";

type AskAvailability = "everyone" | "logged-in" | "followers" | "off";
type ProfilePerspective = "me" | "public";

const promptOptions = [
  "What changed your mind recently?",
  "What are you tired of pretending?",
  "What advice aged badly?",
  "What feels easier now?",
] as const;

const answers = [
  {
    question: "How do you stay consistent without turning your whole life into a schedule?",
    answer:
      "I use anchors, not full schedules. Two reliable anchors per day (like a fixed morning reading block and a shutdown walk at 6 PM) are easier to protect than a perfect plan that breaks by lunch.",
    meta: "12m ago",
    likes: 428,
  },
  {
    question: "Do you ever regret posting personal answers?",
    answer:
      "Yes, when I answer too quickly under emotional impulse. Drafting helps. If the answer still feels honest and constructive after a full night's sleep, I publish it.",
    meta: "Yesterday",
    likes: 301,
  },
] as const;

type ToastState = {
  message: string;
  tone: "danger" | "success";
};

const askAvailabilityOptions = [
  {
    description: "Anyone can send a question from the public profile.",
    label: "Everyone",
    value: "everyone",
  },
  {
    description: "Visitors must sign in before the ask form accepts input.",
    label: "Logged-in only",
    value: "logged-in",
  },
  {
    description: "Only followers can submit questions.",
    label: "Followers only",
    value: "followers",
  },
  {
    description: "The public ask box stays visible, but submissions are paused.",
    label: "Ask off",
    value: "off",
  },
] as const satisfies readonly {
  description: string;
  label: string;
  value: AskAvailability;
}[];

export function ProfilePage() {
  const [profilePerspective, setProfilePerspective] =
    React.useState<ProfilePerspective>("me");
  const [question, setQuestion] = React.useState("");
  const [isAnonymous, setIsAnonymous] = React.useState(true);
  const [askAvailability, setAskAvailability] =
    React.useState<AskAvailability>("everyone");
  const [deliveryStatus, setDeliveryStatus] = React.useState<
    { message: string; tone: ToastState["tone"] } | null
  >(null);
  const [followUpsAllowed, setFollowUpsAllowed] = React.useState(true);
  const [followUpText, setFollowUpText] = React.useState("");
  const [threadLiked, setThreadLiked] = React.useState(false);
  const [likedQuestions, setLikedQuestions] = React.useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [toast, setToast] = React.useState<ToastState | null>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setToast(null);
    }, 3000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [toast]);

  function triggerToast(message: string, tone: ToastState["tone"] = "success") {
    setToast({ message, tone });
  }

  function handlePromptSelect(prompt: string) {
    setQuestion(`"${prompt}"\n\n`);
    textareaRef.current?.focus();
    triggerToast("Prompt selected! Add your notes below.");
  }

  function handleAnonymousChange(event: React.ChangeEvent<HTMLInputElement>) {
    const checked = event.target.checked;

    setIsAnonymous(checked);
    triggerToast(
      checked
        ? "Question mode set to: Anonymous"
        : "Question mode set to: Public Profile",
    );
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDeliveryStatus(null);

    const unavailableMessage = getAskUnavailableMessage(askAvailability);

    if (unavailableMessage) {
      setDeliveryStatus({ message: unavailableMessage, tone: "danger" });
      triggerToast(unavailableMessage, "danger");
      return;
    }

    if (!question.trim()) {
      const message = "Please write a question or pick a prompt first!";
      setDeliveryStatus({ message, tone: "danger" });
      triggerToast(message, "danger");
      textareaRef.current?.focus();
      return;
    }

    setQuestion("");
    setDeliveryStatus({
      message: isAnonymous
        ? "Question sent anonymously to Maya Chen."
        : "Question sent as @visitor.",
      tone: "success",
    });
    triggerToast("Question sent successfully to Maya Chen!");
  }

  function handleFollowUpSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!followUpsAllowed) {
      triggerToast("Follow-ups are unavailable on this thread.", "danger");
      return;
    }

    if (!followUpText.trim()) {
      triggerToast("Write a follow-up before sending.", "danger");
      return;
    }

    setFollowUpText("");
    triggerToast("Follow-up sent to Maya Chen.");
  }

  function toggleLike(questionText: string, baseCount: number) {
    setLikedQuestions((current) => {
      const next = new Set(current);
      const isLiked = next.has(questionText);

      if (isLiked) {
        next.delete(questionText);
        triggerToast("Removed reaction");
      } else {
        next.add(questionText);
        triggerToast("Liked answer!");
      }

      return next;
    });
  }

  return (
    <div className="gemini-profile">
      <main className="gemini-app-shell" role="main">
        <ProfileHeader
          onPerspectiveChange={setProfilePerspective}
          onFollow={() => {
            triggerToast("You followed @mayachen!");
          }}
          onShare={() => {
            triggerToast("Profile URL copied.");
          }}
          perspective={profilePerspective}
        />

        <div className="gemini-layout-columns">
          <div className="gemini-flow-column">
            <AskComposer
              askAvailability={askAvailability}
              deliveryStatus={deliveryStatus}
              isAnonymous={isAnonymous}
              onAnonymousChange={handleAnonymousChange}
              onPromptSelect={handlePromptSelect}
              onQuestionChange={setQuestion}
              onSubmit={handleSubmit}
              question={question}
              textareaRef={textareaRef}
            />

            <AnswersFeed
              likedQuestions={likedQuestions}
              onToggleLike={toggleLike}
            />

            <PublicThreadPreview
              followUpsAllowed={followUpsAllowed}
              followUpText={followUpText}
              onFollowUpTextChange={setFollowUpText}
              onSubmitFollowUp={handleFollowUpSubmit}
              onToggleFollowUps={() => {
                setFollowUpsAllowed((current) => !current);
                triggerToast(
                  followUpsAllowed
                    ? "Follow-ups disabled for this thread."
                    : "Follow-ups enabled for this thread.",
                );
              }}
              onToggleThreadLike={() => {
                setThreadLiked((current) => !current);
                triggerToast(threadLiked ? "Removed reaction" : "Liked thread!");
              }}
              threadLiked={threadLiked}
            />
          </div>

          <aside
            aria-label="Profile context information"
            className="gemini-context-rail"
          >
            {profilePerspective === "me" ? (
              <AskAvailabilityCard
                askAvailability={askAvailability}
                onAskAvailabilityChange={(value) => {
                  setAskAvailability(value);
                  setDeliveryStatus(null);
                  triggerToast(
                    `Ask state set to: ${
                      askAvailabilityOptions.find(
                        (option) => option.value === value,
                      )?.label ?? value
                    }`,
                  );
                }}
              />
            ) : null}
            <PinnedThreadsCard onToast={triggerToast} />
          </aside>
        </div>
      </main>

      <GeminiNotification
        message={toast?.message ?? ""}
        open={Boolean(toast)}
        tone={toast?.tone ?? "success"}
      />
    </div>
  );
}

type ProfileHeaderProps = {
  onPerspectiveChange: (perspective: ProfilePerspective) => void;
  onFollow: () => void;
  onShare: () => void;
  perspective: ProfilePerspective;
};

const profilePerspectiveOptions = [
  { value: "me", label: "Me" },
  { value: "public", label: "Public preview" },
] as const satisfies readonly { label: string; value: ProfilePerspective }[];

function ProfileHeader({
  onFollow,
  onPerspectiveChange,
  onShare,
  perspective,
}: ProfileHeaderProps) {
  const isOwnerView = perspective === "me";

  return (
    <section
      aria-label="Profile identity card"
      className="gemini-profile-header-container"
    >
      <div className="gemini-cover-banner">
        <div className="gemini-grid-overlay" />
      </div>

      <div className="gemini-profile-body-inner">
        <div className="gemini-profile-meta-top">
          <div className="gemini-avatar-wrapper">
            <div aria-label="Avatar for MC" className="gemini-profile-avatar">
              MC
            </div>
          </div>

          <div className="gemini-profile-info">
            <h1 className="gemini-profile-name">Maya Chen</h1>
            <p className="gemini-profile-handle">
              @mayachen · Joined March 2024
            </p>
            <p className="gemini-profile-bio">
              Notes on studying, quiet ambition, and staying kind online. Ask
              direct questions. I answer the useful ones.
            </p>
          </div>

          <div className="gemini-profile-actions">
            <button
              className="gemini-header-cta"
              onClick={isOwnerView ? onShare : onFollow}
              type="button"
            >
              {isOwnerView ? (
                <Share2 aria-hidden="true" size={16} strokeWidth={2.5} />
              ) : (
                <Plus aria-hidden="true" size={16} strokeWidth={2.5} />
              )}
              <span>{isOwnerView ? "Share" : "Follow"}</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="gemini-profile-stats">
            <span className="gemini-stat-pill">
              <strong>142</strong> answers
            </span>
            <span className="gemini-stat-pill">
              <strong>2.4k</strong> followers
            </span>
            <span className="gemini-stat-pill">
              <strong>18k</strong> reactions
            </span>
          </div>

          <nav
            aria-label="Profile preview mode"
            className="gemini-profile-stats profile-mode-switch"
          >
            {profilePerspectiveOptions.map((option) => (
              <button
                aria-current={option.value === perspective ? "page" : undefined}
                className={cn(
                  "gemini-stat-pill transition-colors",
                  option.value === perspective &&
                    "border-primary bg-primary/10 text-primary",
                )}
                key={option.value}
                onClick={() => {
                  onPerspectiveChange(option.value);
                }}
                type="button"
              >
                <strong>{option.label}</strong>
              </button>
            ))}
          </nav>
        </div>
      </div>
    </section>
  );
}

type AskComposerProps = {
  askAvailability: AskAvailability;
  deliveryStatus: { message: string; tone: ToastState["tone"] } | null;
  question: string;
  isAnonymous: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onQuestionChange: (question: string) => void;
  onAnonymousChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onPromptSelect: (prompt: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

function AskComposer({
  askAvailability,
  deliveryStatus,
  question,
  isAnonymous,
  textareaRef,
  onQuestionChange,
  onAnonymousChange,
  onPromptSelect,
  onSubmit,
}: AskComposerProps) {
  const unavailableMessage = getAskUnavailableMessage(askAvailability);

  return (
    <form
      aria-label="Ask a question"
      className="gemini-composer-card"
      onSubmit={onSubmit}
    >
      <div className="gemini-composer-header">
        <div className="gemini-composer-title">
          <Mail aria-hidden="true" size={16} strokeWidth={2} />
          <span>
            {isAnonymous ? "Send Maya a question" : "Ask Maya as @visitor"}
          </span>
        </div>
        <div className="gemini-composer-right">
          {isAnonymous ? "Anonymous" : "@visitor"}
        </div>
      </div>

      <div className="gemini-question-ceremony">
        <div className="gemini-ceremony-meta">Question ceremony</div>
        <h2 className="gemini-ceremony-title">
          Pick a prompt or write your own.
        </h2>

        <div className="gemini-prompts-scroll">
          {promptOptions.map((prompt) => (
            <button
              className="gemini-prompt-card"
              key={prompt}
              onClick={() => {
                onPromptSelect(prompt);
              }}
              type="button"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      <div className="gemini-composer-body">
        <textarea
          aria-label="Question text"
          className="gemini-composer-textarea"
          disabled={Boolean(unavailableMessage)}
          maxLength={500}
          onChange={(event) => {
            onQuestionChange(event.target.value);
          }}
          placeholder={
            unavailableMessage ?? "Ask Maya something specific..."
          }
          ref={textareaRef}
          value={question}
        />
      </div>

      <div className="gemini-composer-footer">
        <label className="gemini-toggle-label">
          <input
            checked={isAnonymous}
            className="gemini-toggle-input"
            onChange={onAnonymousChange}
            type="checkbox"
          />
          <span className="gemini-toggle-pill" />
          <span>Send anonymously</span>
        </label>

        <span aria-live="polite" className="sr-only">
          {deliveryStatus?.message ?? getAskAvailabilityLabel(askAvailability)}
        </span>

        <button
          className="gemini-send-btn disabled:cursor-not-allowed disabled:opacity-55"
          disabled={question.length > 500}
          type="submit"
        >
          <span>Send question</span>
          <Send aria-hidden="true" size={14} strokeWidth={2.5} />
        </button>
      </div>
    </form>
  );
}

function getAskAvailabilityLabel(askAvailability: AskAvailability) {
  return (
    askAvailabilityOptions.find((option) => option.value === askAvailability)
      ?.label ?? "Everyone"
  );
}

function getAskUnavailableMessage(askAvailability: AskAvailability) {
  if (askAvailability === "logged-in") {
    return "Sign in to ask Maya a question.";
  }

  if (askAvailability === "followers") {
    return "Follow Maya before sending a question.";
  }

  if (askAvailability === "off") {
    return "Maya is not accepting new questions right now.";
  }

  return null;
}

type AnswersFeedProps = {
  likedQuestions: ReadonlySet<string>;
  onToggleLike: (question: string, baseCount: number) => void;
};

function AnswersFeed({ likedQuestions, onToggleLike }: AnswersFeedProps) {
  return (
    <section aria-label="Answers Feed" className="gemini-feed-container">
      <div className="gemini-feed-title">
        Answers Feed <span>Latest</span>
      </div>

      {answers.map((answer) => {
        const isLiked = likedQuestions.has(answer.question);
        const likes = answer.likes + (isLiked ? 1 : 0);

        return (
          <article className="gemini-content-card" key={answer.question}>
            <div className="gemini-q-row">
              <span aria-hidden="true" className="gemini-q-badge">
                Q
              </span>
              <h3 className="gemini-q-text">{answer.question}</h3>
            </div>

            <div className="gemini-a-row">
              <p>{answer.answer}</p>
            </div>

            <div className="gemini-card-footer">
              <div className="gemini-author-link">
                <span className="gemini-author-name">Maya Chen</span>
                <span className="gemini-date-mono">· {answer.meta}</span>
              </div>

              <button
                aria-pressed={isLiked}
                className={cn("gemini-heart-btn", isLiked && "liked")}
                onClick={() => {
                  onToggleLike(answer.question, answer.likes);
                }}
                type="button"
              >
                <Heart aria-hidden="true" size={14} strokeWidth={2.5} />
                <span className="like-count">{likes}</span>
              </button>
            </div>
          </article>
        );
      })}
    </section>
  );
}

type PublicThreadPreviewProps = {
  followUpsAllowed: boolean;
  followUpText: string;
  onFollowUpTextChange: (value: string) => void;
  onSubmitFollowUp: (event: React.FormEvent<HTMLFormElement>) => void;
  onToggleFollowUps: () => void;
  onToggleThreadLike: () => void;
  threadLiked: boolean;
};

function PublicThreadPreview({
  followUpsAllowed,
  followUpText,
  onFollowUpTextChange,
  onSubmitFollowUp,
  onToggleFollowUps,
  onToggleThreadLike,
  threadLiked,
}: PublicThreadPreviewProps) {
  return (
    <section aria-label="Public thread preview" className="gemini-feed-container">
      <div className="gemini-feed-title">
        Public Thread <span>Preview</span>
      </div>

      <article className="gemini-content-card">
        <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="gemini-date-mono">/mayachen/a/thread-2J4</div>
            <h3 className="mt-2 font-serif text-2xl font-extrabold italic leading-tight text-primary">
              "How do you stay consistent without turning your whole life into a schedule?"
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              aria-pressed={threadLiked}
              className={cn("gemini-heart-btn", threadLiked && "liked")}
              onClick={onToggleThreadLike}
              type="button"
            >
              <Heart aria-hidden="true" size={14} strokeWidth={2.5} />
              <span>{threadLiked ? 429 : 428}</span>
            </button>
            <button
              className="gemini-heart-btn"
              onClick={onToggleFollowUps}
              type="button"
            >
              {followUpsAllowed ? "Close follow-ups" : "Allow follow-ups"}
            </button>
          </div>
        </header>

        <div className="border-y border-dashed border-border py-4">
          <ThreadEvent
            actor="Anonymous"
            body="How do you stay consistent without turning your whole life into a schedule?"
            kind="Question"
            time="2 hours ago"
          />
          <ThreadEvent
            actor="Maya Chen"
            body="I use anchors, not full schedules. Two reliable anchors per day are easier to protect than a perfect plan that breaks by lunch."
            kind="Answer"
            time="12m ago"
          />
          <div className="rounded-[0.625rem] border border-dashed border-border bg-secondary px-3.5 py-3 text-sm text-muted-foreground">
            Removed question · sender blocked by owner
          </div>
        </div>

        <form className="mt-5" onSubmit={onSubmitFollowUp}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-bold text-foreground">
              Follow-up question
            </h4>
            <span className="gemini-date-mono">
              {followUpsAllowed ? "Available" : "Unavailable"}
            </span>
          </div>
          <textarea
            aria-label="Follow-up question"
            className="gemini-composer-textarea min-h-24 rounded-[0.625rem] border border-border bg-secondary p-4"
            disabled={!followUpsAllowed}
            maxLength={500}
            onChange={(event) => {
              onFollowUpTextChange(event.target.value);
            }}
            placeholder={
              followUpsAllowed
                ? "Ask a follow-up on this answer..."
                : "Maya closed follow-ups on this thread."
            }
            value={followUpText}
          />
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="font-mono text-[0.68rem] text-muted-foreground">
              {followUpText.length}/500
            </span>
            <button
              className="gemini-send-btn justify-center disabled:cursor-not-allowed disabled:opacity-55"
              disabled={!followUpsAllowed}
              type="submit"
            >
              <span>Send follow-up</span>
              <Send aria-hidden="true" size={14} strokeWidth={2.5} />
            </button>
          </div>
        </form>
      </article>
    </section>
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
        <span className="gemini-date-mono">
          {actor} · {time}
        </span>
      </div>
      <p className="text-sm leading-7 text-foreground/90">{body}</p>
    </div>
  );
}

type AskAvailabilityCardProps = {
  askAvailability: AskAvailability;
  onAskAvailabilityChange: (value: AskAvailability) => void;
};

function AskAvailabilityCard({
  askAvailability,
  onAskAvailabilityChange,
}: AskAvailabilityCardProps) {
  return (
    <div className="gemini-content-card gemini-rail-card">
      <h3 className="gemini-rail-title">Ask State</h3>
      <p className="gemini-rail-copy">
        Toggle the public ask box state without leaving the profile preview.
      </p>
      <div className="flex flex-col gap-2">
        {askAvailabilityOptions.map((option) => (
          <button
            aria-pressed={option.value === askAvailability}
            className={cn(
              "rounded-[0.625rem] border border-border bg-secondary px-3 py-2 text-left transition-colors hover:border-primary/40",
              option.value === askAvailability && "border-primary bg-primary/10",
            )}
            key={option.value}
            onClick={() => {
              onAskAvailabilityChange(option.value);
            }}
            type="button"
          >
            <span className="block text-sm font-bold text-foreground">
              {option.label}
            </span>
            <span className="mt-1 block text-xs leading-5 text-muted-foreground">
              {option.description}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

type PinnedThreadsCardProps = {
  onToast: (message: string) => void;
};

function PinnedThreadsCard({ onToast }: PinnedThreadsCardProps) {
  return (
    <div className="gemini-content-card gemini-rail-card">
      <h3 className="gemini-rail-title">Pinned Threads</h3>
      <div className="gemini-pinned-list">
        <a
          className="gemini-pinned-link"
          href="#thread-study-habits"
          onClick={(event) => {
            event.preventDefault();
            onToast("Loading Thread: Study Habits");
          }}
        >
          <h4>"What changed your mind recently?"</h4>
          <p>4 responses · Updated 2 days ago</p>
        </a>
        <a
          className="gemini-pinned-link"
          href="#thread-career-anchors"
          onClick={(event) => {
            event.preventDefault();
            onToast("Loading Thread: Career Anchors");
          }}
        >
          <h4>"Does your reset strategy ever backfire?"</h4>
          <p>3 responses · Updated 5 days ago</p>
        </a>
      </div>
    </div>
  );
}
