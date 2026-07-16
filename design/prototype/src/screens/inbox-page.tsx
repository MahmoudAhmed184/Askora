import * as React from "react";
import {
  Ban,
  Check,
  Flag,
  MoreHorizontal,
  PenLine,
  ShieldAlert,
  Trash2,
} from "lucide-react";

import { GeminiNotification } from "../components/notifications/gemini-notification";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "../components/ui/card";
import { Textarea } from "../components/ui/textarea";
import { cn } from "../lib/utils";

type InboxTab = "all" | "draft" | "filtered";
type QuestionTextMode = "original" | "edited" | "hidden";

type ToastState = {
  message: string;
  tone: "danger" | "success";
};

type Question = {
  id: string;
  question: string;
  sender:
    | {
        kind: "anonymous";
        time: string;
      }
    | {
        handle: string;
        initials: string;
        kind: "person";
        name: string;
        time: string;
        tone: "accent" | "primary";
      };
};

type DraftAnswer = {
  characters: number;
  id: string;
  question: string;
  text: string;
  time: string;
};

type FilteredQuestion = {
  id: string;
  label: string;
  match: string;
  question: string;
  time: string;
};

const inboxTabs = [
  { value: "all", label: "All Questions", count: 12, danger: false },
  { value: "draft", label: "Drafts", count: 3, danger: false },
  { value: "filtered", label: "Filtered", count: 2, danger: true },
] as const;

const questions: readonly Question[] = [
  {
    id: "q-card-1",
    question:
      "How do you stay consistent without turning your whole life into a schedule?",
    sender: { kind: "anonymous", time: "2 hours ago" },
  },
  {
    id: "q-card-2",
    question:
      "I loved your last essay on cognitive anchors. Do you think this strategy applies to creative work too, or is it strictly for analytical sessions?",
    sender: {
      handle: "@alexl",
      initials: "AL",
      kind: "person",
      name: "Alex Leyton",
      time: "5 hours ago",
      tone: "primary",
    },
  },
  {
    id: "q-card-3",
    question:
      "What's the hardest part about deactivating or cleaning up older, highly-reacted answers? Is it emotional or structural?",
    sender: {
      handle: "@sarahm",
      initials: "SM",
      kind: "person",
      name: "Sarah Miller",
      time: "Yesterday",
      tone: "accent",
    },
  },
] as const;

const draftAnswers: readonly DraftAnswer[] = [
  {
    characters: 180,
    id: "draft-1",
    question:
      "What's the hardest part about deactivating or cleaning up older answers?",
    text: "It is definitely the emotional attachment to past thoughts. We grow and change, yet the static web keeps our historical snapshots forever. Overcoming that friction is...",
    time: "Edited 20m ago",
  },
  {
    characters: 212,
    id: "draft-2",
    question: "Does your reset strategy ever backfire?",
    text: "Yes. If my anchor is a walk, but I walk while scrolling or reading, it fails to reset. The physical action is there, but the cognitive attention remains locked. To succeed, it must be...",
    time: "Edited 1 day ago",
  },
] as const;

const filteredQuestions: readonly FilteredQuestion[] = [
  {
    id: "filtered-card-1",
    label: "Muted phrase matched",
    match: 'Matching phrase: "promo code"',
    question:
      "Hey Maya! Do you want to try our new planner software for free? Use promo code PLANNER99 at checkout!",
    time: "3 days ago",
  },
  {
    id: "filtered-card-2",
    label: "Spam / Bot signal",
    match: "Automated detection",
    question:
      "Follow for follow back? I follow everyone who reactions on my posts. Cheers!",
    time: "4 days ago",
  },
] as const;

export function InboxPage() {
  const [activeTab, setActiveTab] = React.useState<InboxTab>("all");
  const [visibleQuestionIds, setVisibleQuestionIds] = React.useState(
    () => new Set(questions.map((question) => question.id)),
  );
  const [visibleFilteredIds, setVisibleFilteredIds] = React.useState(
    () => new Set(filteredQuestions.map((question) => question.id)),
  );
  const [openMenuId, setOpenMenuId] = React.useState<string | null>(null);
  const [editorQuestionId, setEditorQuestionId] = React.useState<string | null>(
    null,
  );
  const [questionTextMode, setQuestionTextMode] =
    React.useState<QuestionTextMode>("original");
  const [answerText, setAnswerText] = React.useState("");
  const [followUpOverride, setFollowUpOverride] = React.useState("Thread default");
  const [toast, setToast] = React.useState<ToastState | null>(null);

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

  function switchTab(tab: InboxTab) {
    setActiveTab(tab);
    setOpenMenuId(null);
    triggerToast(`Switched folder view: ${tab.toUpperCase()}`);
  }

  function dismissQuestion(id: string) {
    setVisibleQuestionIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
    triggerToast("Question dismissed and dropped.", "danger");
  }

  function restoreFilteredQuestion(id: string) {
    setVisibleFilteredIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
    triggerToast("Question approved and restored to Inbox!");
  }

  const visibleQuestions = questions.filter((question) =>
    visibleQuestionIds.has(question.id),
  );
  const visibleFilteredQuestions = filteredQuestions.filter((question) =>
    visibleFilteredIds.has(question.id),
  );
  const editorQuestion = editorQuestionId
    ? (questions.find((question) => question.id === editorQuestionId) ??
      questions[0])
    : null;

  return (
    <div className="min-h-svh bg-background pb-32 text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/82 backdrop-blur-md">
        <div className="mx-auto max-w-2xl px-4 sm:px-6">
          <div className="flex h-16 items-center justify-center">
            <h1 className="font-serif text-3xl font-bold tracking-tight text-primary">
              Inbox
            </h1>
          </div>

          <nav
            aria-label="Inbox folders"
            className="no-scrollbar -mb-px flex justify-center gap-1 overflow-x-auto pb-3"
            role="tablist"
          >
            {inboxTabs.map((tab) => {
              const isActive = tab.value === activeTab;

              return (
                <button
                  aria-selected={isActive}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 border-b-2 px-4 py-2 text-xs font-bold transition-colors",
                    isActive
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                    tab.danger && !isActive && "text-destructive/75",
                  )}
                  key={tab.value}
                  onClick={() => {
                    switchTab(tab.value);
                  }}
                  role="tab"
                  type="button"
                >
                  {tab.danger ? (
                    <ShieldAlert data-icon="inline-start" />
                  ) : null}
                  <span>{tab.label}</span>
                  <Badge
                    className="px-1.5 py-0.5 text-[0.625rem]"
                    variant={
                      tab.danger
                        ? "destructive"
                        : isActive
                          ? "violet"
                          : "secondary"
                    }
                  >
                    {tab.count}
                  </Badge>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 pt-8 sm:px-6">
        {activeTab === "all" ? (
          <section aria-label="All Questions" className="flex flex-col gap-6">
            {visibleQuestions.map((question) => (
              <QuestionCard
                key={question.id}
                onDismiss={() => {
                  dismissQuestion(question.id);
                }}
                onMenuChange={setOpenMenuId}
                onToast={triggerToast}
                onWriteAnswer={() => {
                  setEditorQuestionId(question.id);
                  setActiveTab("all");
                }}
                openMenuId={openMenuId}
                question={question}
              />
            ))}

            <div className="py-8 text-center">
              <p className="font-mono text-xs text-muted-foreground">
                {visibleQuestions.length > 0
                  ? "You have triaged all recent items."
                  : "The current queue is clear."}
              </p>
            </div>

          </section>
        ) : null}

        {activeTab === "draft" ? (
          <DraftsPanel onToast={triggerToast} />
        ) : null}

        {activeTab === "filtered" ? (
          <FilteredPanel
            filteredQuestions={visibleFilteredQuestions}
            onDismiss={(id) => {
              setVisibleFilteredIds((current) => {
                const next = new Set(current);
                next.delete(id);
                return next;
              });
              triggerToast("Question deleted permanently.", "danger");
            }}
            onRestore={restoreFilteredQuestion}
            onToast={triggerToast}
          />
        ) : null}
      </main>

      <GeminiNotification
        message={toast?.message ?? ""}
        open={Boolean(toast)}
        tone={toast?.tone ?? "success"}
      />

      {editorQuestion ? (
        <AnswerEditor
          answerText={answerText}
          followUpOverride={followUpOverride}
          onAnswerTextChange={setAnswerText}
          onClose={() => {
            setEditorQuestionId(null);
          }}
          onFollowUpOverrideChange={setFollowUpOverride}
          onQuestionTextModeChange={setQuestionTextMode}
          onToast={triggerToast}
          question={editorQuestion}
          questionTextMode={questionTextMode}
        />
      ) : null}
    </div>
  );
}

type QuestionCardProps = {
  onDismiss: () => void;
  onMenuChange: (id: string | null) => void;
  onToast: (message: string, tone?: ToastState["tone"]) => void;
  onWriteAnswer: () => void;
  openMenuId: string | null;
  question: Question;
};

function QuestionCard({
  onDismiss,
  onMenuChange,
  onToast,
  onWriteAnswer,
  openMenuId,
  question,
}: QuestionCardProps) {
  return (
    <Card className="overflow-visible rounded-3xl transition-colors duration-300 hover:border-border-strong">
      <CardContent className="p-6 sm:p-8">
        <div className="mb-5 flex items-start justify-between gap-4">
          <QuestionSender question={question} />

          <div className="relative">
            <Button
              aria-expanded={openMenuId === question.id}
              aria-haspopup="menu"
              onClick={() => {
                onMenuChange(openMenuId === question.id ? null : question.id);
              }}
              size="icon"
              type="button"
              variant="ghost"
            >
              <MoreHorizontal data-icon="inline-start" />
              <span className="sr-only">Question actions</span>
            </Button>

            {openMenuId === question.id ? (
              <div
                className="absolute right-0 top-11 z-30 w-52 rounded-xl border border-border bg-card py-1 shadow-lg"
                role="menu"
              >
                <button
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-xs text-foreground hover:bg-muted"
                  onClick={() => {
                    onMenuChange(null);
                    onToast(
                      question.sender.kind === "anonymous"
                        ? "Flagged anonymous user"
                        : `Flagged ${question.sender.name}`,
                    );
                  }}
                  role="menuitem"
                  type="button"
                >
                  <Flag data-icon="inline-start" />
                  Flag question
                </button>
                <button
                  className={cn(
                    "flex w-full items-center gap-2 px-4 py-2 text-left text-xs hover:bg-muted",
                    question.sender.kind === "anonymous"
                      ? "text-destructive"
                      : "text-foreground",
                  )}
                  onClick={() => {
                    onMenuChange(null);
                    onToast(
                      question.sender.kind === "anonymous"
                        ? "User blocked"
                        : `Blocked ${question.sender.name}`,
                      "danger",
                    );
                  }}
                  role="menuitem"
                  type="button"
                >
                  <Ban data-icon="inline-start" />
                  Block sender
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <h2 className="mb-8 font-serif text-xl font-bold italic leading-normal text-foreground sm:text-2xl">
          "{question.question}"
        </h2>

        <div className="grid grid-cols-1 gap-3 min-[430px]:grid-cols-2">
          <Button
            onClick={onWriteAnswer}
            type="button"
          >
            <PenLine data-icon="inline-start" />
            Answer question
          </Button>
          <Button onClick={onDismiss} type="button" variant="destructive">
            <Trash2 data-icon="inline-start" />
            Drop
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function QuestionSender({ question }: { question: Question }) {
  if (question.sender.kind === "anonymous") {
    return (
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Badge className="font-mono text-[0.625rem]" variant="outline">
          Anonymous
        </Badge>
        <span className="font-mono text-[0.6875rem] text-muted-foreground">
          · {question.sender.time}
        </span>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-3">
      <div
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full border font-serif text-xs font-bold",
          question.sender.tone === "primary"
            ? "border-primary/20 bg-primary/10 text-primary"
            : "border-accent/20 bg-accent/15 text-accent",
        )}
      >
        {question.sender.initials}
      </div>
      <div className="min-w-0">
        <div className="truncate text-xs font-bold text-foreground">
          {question.sender.name}
        </div>
        <div className="mt-0.5 truncate font-mono text-[0.625rem] text-muted-foreground">
          {question.sender.handle} · {question.sender.time}
        </div>
      </div>
    </div>
  );
}

function AnswerEditor({
  answerText,
  followUpOverride,
  onAnswerTextChange,
  onClose,
  onFollowUpOverrideChange,
  onQuestionTextModeChange,
  onToast,
  question,
  questionTextMode,
}: {
  answerText: string;
  followUpOverride: string;
  onAnswerTextChange: (text: string) => void;
  onClose: () => void;
  onFollowUpOverrideChange: (value: string) => void;
  onQuestionTextModeChange: (mode: QuestionTextMode) => void;
  onToast: (message: string, tone?: ToastState["tone"]) => void;
  question: Question;
  questionTextMode: QuestionTextMode;
}) {
  const questionText = getQuestionPreviewText(question.question, questionTextMode);
  const answerLimit = 3000;
  const charactersRemaining = answerLimit - answerText.length;

  React.useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", closeOnEscape);

    return () => {
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-foreground/25 px-4 py-6 backdrop-blur-sm sm:py-10"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <Card
        aria-labelledby="answer-editor-title"
        aria-modal="true"
        className="max-h-[calc(100svh-2rem)] w-full max-w-[53rem] overflow-y-auto rounded-3xl shadow-[0_24px_80px_oklch(0.16_0.035_295_/_0.22)]"
        role="dialog"
      >
        <CardHeader className="border-b border-border/60 bg-secondary p-6 sm:p-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <Badge className="mb-3 font-mono text-[0.625rem]" variant="violet">
                Answer editor
              </Badge>
              <h2
                className="font-serif text-2xl font-bold tracking-tight text-foreground"
                id="answer-editor-title"
              >
                Prepare response
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Edit the visible question text, set follow-up behavior, then save
                or publish.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <QuestionSender question={question} />
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-5 p-6 sm:p-8">
          <div>
            <div className="mb-3 flex flex-wrap gap-2">
              {(["original", "edited", "hidden"] as const).map((mode) => (
                <Button
                  key={mode}
                  onClick={() => {
                    onQuestionTextModeChange(mode);
                  }}
                  size="sm"
                  type="button"
                  variant={questionTextMode === mode ? "default" : "outline"}
                >
                  {mode === "original"
                    ? "Original"
                    : mode === "edited"
                      ? "Edited"
                      : "Hidden"}
                </Button>
              ))}
            </div>
            <div
              className={cn(
                "rounded-xl border border-border bg-secondary p-4 font-serif text-lg font-bold italic leading-normal text-foreground",
                questionTextMode === "hidden" &&
                  "text-muted-foreground line-through decoration-destructive/40",
              )}
            >
              "{questionText}"
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-4">
              <label
                className="text-sm font-bold text-foreground"
                htmlFor="inbox-answer-editor"
              >
                Answer
              </label>
              <span
                className={cn(
                  "font-mono text-[0.68rem]",
                  charactersRemaining < 0
                    ? "text-destructive"
                    : "text-muted-foreground",
                )}
              >
                {Math.max(charactersRemaining, 0)} left
              </span>
            </div>
            <Textarea
              id="inbox-answer-editor"
              maxLength={answerLimit}
              onChange={(event) => {
                onAnswerTextChange(event.target.value);
              }}
              placeholder="Write the answer Maya will publish..."
              value={answerText}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                className="mb-2 block text-sm font-bold text-foreground"
                htmlFor="follow-up-override"
              >
                Follow-up override
              </label>
              <select
                className="flex h-10 w-full rounded-[0.625rem] border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25"
                id="follow-up-override"
                onChange={(event) => {
                  onFollowUpOverrideChange(event.target.value);
                }}
                value={followUpOverride}
              >
                <option>Thread default</option>
                <option>Allow anyone</option>
                <option>Logged-in users</option>
                <option>Original asker only</option>
                <option>No follow-ups</option>
              </select>
            </div>
            <div className="hidden rounded-xl border border-border bg-secondary p-3 text-xs leading-5 text-muted-foreground sm:block">
              Reporting or blocking remains available from the editor before
              publishing.
            </div>
          </div>
        </CardContent>

        <CardFooter className="sticky bottom-0 z-10 flex-col items-stretch justify-between gap-3 border-t border-border/60 bg-secondary p-6 sm:flex-row sm:items-center sm:p-8">
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                onToast("Question reported for review.", "danger");
              }}
              type="button"
              variant="outline"
            >
              <Flag data-icon="inline-start" />
              Report
            </Button>
            <Button
              onClick={() => {
                onToast("Sender blocked.", "danger");
              }}
              type="button"
              variant="outline"
            >
              <Ban data-icon="inline-start" />
              Block
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                onToast("Draft saved.");
              }}
              type="button"
              variant="outline"
            >
              Save draft
            </Button>
            <Button
              onClick={() => {
                if (!answerText.trim()) {
                  onToast("Write an answer before publishing.", "danger");
                  return;
                }
                onToast("Answer published successfully!");
                onClose();
              }}
              type="button"
            >
              Publish answer
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}

function getQuestionPreviewText(question: string, mode: QuestionTextMode) {
  if (mode === "edited") {
    return "How do you stay consistent without over-scheduling your day?";
  }

  if (mode === "hidden") {
    return "Question hidden by owner";
  }

  return question;
}

function DraftsPanel({
  onToast,
}: {
  onToast: (message: string, tone?: ToastState["tone"]) => void;
}) {
  return (
    <section aria-label="Drafts" className="flex flex-col gap-6">
      {draftAnswers.map((draft) => (
        <Card className="rounded-3xl" key={draft.id}>
          <CardHeader className="flex-row items-start justify-between gap-4 border-b border-border/60 p-6 pb-4 sm:p-8 sm:pb-4">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Badge className="font-mono text-[0.625rem]" variant="violet">
                Draft
              </Badge>
              <span className="font-mono text-[0.625rem] text-muted-foreground">
                · {draft.time}
              </span>
            </div>
            <Button
              onClick={() => {
                onToast("Draft deleted", "danger");
              }}
              size="sm"
              type="button"
              variant="link"
            >
              <Trash2 data-icon="inline-start" />
              Delete
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-5 p-6 sm:p-8">
            <p className="font-serif text-lg font-bold italic text-foreground">
              "{draft.question}"
            </p>
            <Textarea
              className="min-h-28 rounded-xl bg-muted p-4"
              defaultValue={draft.text}
            />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="font-mono text-[0.6875rem] text-muted-foreground">
                {draft.characters} characters written
              </span>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => {
                    onToast("Draft auto-saved");
                  }}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Save draft
                </Button>
                <Button
                  onClick={() => {
                    onToast("Draft published successfully!");
                  }}
                  size="sm"
                  type="button"
                >
                  Publish Answer
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}

function FilteredPanel({
  filteredQuestions,
  onDismiss,
  onRestore,
  onToast,
}: {
  filteredQuestions: readonly FilteredQuestion[];
  onDismiss: (id: string) => void;
  onRestore: (id: string) => void;
  onToast: (message: string, tone?: ToastState["tone"]) => void;
}) {
  return (
    <section aria-label="Filtered Questions" className="flex flex-col gap-6">
      <div className="flex gap-3 rounded-2xl border border-destructive/25 bg-destructive/10 p-5 text-xs leading-6 text-destructive/85 shadow-sm">
        <ShieldAlert className="mt-0.5 shrink-0 text-destructive" data-icon="inline-start" />
        <div>
          <strong className="mb-1 block font-bold text-foreground">
            Safety-filtered Inbox Folder
          </strong>
          These questions matched your muted phrases list or platform safety
          filters. They do not trigger notifications and are hidden from your
          regular queue.
        </div>
      </div>

      {filteredQuestions.length === 0 ? (
        <Card className="rounded-3xl border-dashed">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Filtered queue is clear.
          </CardContent>
        </Card>
      ) : null}

      {filteredQuestions.map((question) => (
        <Card
          className="rounded-3xl border-destructive/25 transition-colors hover:border-destructive/45"
          key={question.id}
        >
          <CardContent className="p-6 sm:p-8">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <Badge
                  className="font-mono text-[0.5625rem]"
                  variant="destructive"
                >
                  {question.label}
                </Badge>
                <span className="font-mono text-[0.625rem] text-muted-foreground">
                  · {question.match}
                </span>
              </div>
              <span className="font-mono text-xs text-muted-foreground">
                {question.time}
              </span>
            </div>

            <h2 className="mb-6 font-serif text-lg font-bold italic leading-normal text-muted-foreground line-through decoration-destructive/40 sm:text-xl">
              "{question.question}"
            </h2>

            <div className="flex flex-wrap gap-2.5">
              <Button
                className="border-success/20 bg-success/10 text-success hover:bg-success/15"
                onClick={() => {
                  onRestore(question.id);
                }}
                type="button"
                variant="outline"
              >
                <Check data-icon="inline-start" />
                Approve & Restore
              </Button>
              <Button
                onClick={() => {
                  onToast("Sender permanently blocked", "danger");
                }}
                type="button"
                variant="destructive"
              >
                <Ban data-icon="inline-start" />
                Block sender
              </Button>
              <Button
                className="sm:ml-auto"
                onClick={() => {
                  onDismiss(question.id);
                }}
                type="button"
                variant="subtle"
              >
                <Trash2 data-icon="inline-start" />
                Delete Permanently
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
