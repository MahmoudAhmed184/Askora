import { Eye, EyeOff, PencilLine, Send, Save, X } from "lucide-react";
import { useId, useState } from "react";
import { Form, Link } from "react-router";

import { ActionToast } from "~/components/app/action-toast";
import { PendingButton } from "~/components/app/pending-button";
import { Button } from "~/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "~/components/ui/field";
import { Textarea } from "~/components/ui/textarea";
import type {
  AnswerActionResult,
  AnswerEditorViewData,
  AnswerFieldErrors,
  AnswerFormValues,
} from "~/features/answers/answer.server";
import type { QuestionTextMode } from "~/features/answers/answer.schema";
import { QuestionModerationControls } from "~/features/inbox/components/question-moderation-controls";
import type { FollowUpPermission } from "~/features/settings/settings.schema";
import { ThreadContextPreview } from "~/features/threads/components/thread-context-preview";
import { formatMediumDateTime } from "~/lib/date-format";
import { cn } from "~/lib/utils";

interface AnswerEditorProps {
  actionResult: AnswerActionResult | undefined;
  closeHref: string;
  disabled: boolean;
  editor: AnswerEditorViewData;
}

const questionTextModeOptions = [
  {
    value: "original",
    label: "Original",
    description: "Show the question exactly as received.",
    icon: Eye,
  },
  {
    value: "edited",
    label: "Edited",
    description: "Publish a cleaned-up version of the question.",
    icon: PencilLine,
  },
  {
    value: "hidden",
    label: "Hidden",
    description: "Publish the answer without public question text.",
    icon: EyeOff,
  },
] as const;

const followUpPermissionOptions = [
  { value: "anyone", label: "Anyone in the thread" },
  { value: "logged_in", label: "Logged-in users" },
  { value: "original_asker", label: "Original asker only" },
  { value: "off", label: "No follow-ups" },
] as const satisfies readonly { value: FollowUpPermission; label: string }[];

const answerCharacterLimit = 3_000;

export function AnswerEditor({
  actionResult,
  closeHref,
  disabled,
  editor,
}: AnswerEditorProps) {
  const formId = useId();
  const initialValues =
    actionResult?.status === "invalid" || actionResult?.status === "denied"
      ? actionResult.values
      : editor.values;
  const [questionTextMode, setQuestionTextMode] = useState(
    normalizeQuestionTextMode(initialValues.questionTextMode),
  );
  const [answerText, setAnswerText] = useState(initialValues.answerText);
  const fieldErrors = getFieldErrors(actionResult);
  const formError = getFormError(actionResult);
  const answerCharactersRemaining = answerCharacterLimit - answerText.length;

  return (
    <section
      aria-labelledby="answer-editor-title"
      aria-modal="true"
      className="flex max-h-full w-full max-w-[53rem] flex-col overflow-hidden rounded-3xl border bg-card text-card-foreground shadow-[var(--shadow-card)]"
      role="dialog"
    >
      <ActionToast
        message={getAnswerActionToastMessage(actionResult, formError)}
        tone={actionResult?.status === "draft_saved" ? "success" : "error"}
        trigger={actionResult}
      />
      <header className="border-b border-border/60 bg-secondary p-6 sm:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <span className="mb-3 inline-flex rounded-full border bg-card px-2.5 py-1 font-mono text-[0.625rem] font-bold text-primary">
              Answer editor
            </span>
            <h1
              className="font-serif text-2xl font-bold tracking-tight text-foreground"
              id="answer-editor-title"
            >
              Prepare response
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Edit the visible question text, set follow-up behavior, then save or
              publish.
            </p>
          </div>
          <div className="flex items-start gap-3 sm:min-w-80 sm:justify-end">
            <QuestionSender question={editor.question} />
            <Button
              aria-label="Close answer editor"
              asChild
              size="icon"
              variant="ghost"
            >
              <Link to={closeHref}>
                <X data-icon="inline-start" />
              </Link>
            </Button>
          </div>
        </div>
      </header>
      <Form
        aria-label="Answer editor"
        className="min-h-0 flex-1 overflow-y-auto"
        id={formId}
        method="post"
      >
        <FieldGroup className="gap-5 p-6 sm:p-8">
          <fieldset className="contents" disabled={disabled}>
            {editor.threadContext === undefined ? null : (
              <ThreadContextPreview context={editor.threadContext} />
            )}

            <Field
              data-invalid={
                fieldErrors.questionTextMode !== undefined ? true : undefined
              }
            >
              <span className="sr-only">
                Public question text
              </span>
              <div className="flex flex-wrap gap-2">
                {questionTextModeOptions.map((option) => {
                  const Icon = option.icon;
                  return (
                    <label
                      className={cn(
                        "inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm font-bold transition-[background-color,border-color,color,box-shadow]",
                        questionTextMode === option.value
                          ? "border-primary bg-primary text-primary-foreground shadow-[0_4px_12px_var(--accent-glow)]"
                          : "bg-card text-foreground hover:border-primary/40",
                      )}
                      key={option.value}
                    >
                      <input
                        checked={questionTextMode === option.value}
                        className="sr-only"
                        name="questionTextMode"
                        onChange={() => {
                          setQuestionTextMode(option.value);
                        }}
                        type="radio"
                        value={option.value}
                      />
                      <Icon aria-hidden="true" className="size-4" />
                      {option.label}
                    </label>
                  );
                })}
              </div>
              <p className="text-sm leading-6 text-muted-foreground">
                {
                  questionTextModeOptions.find(
                    (option) => option.value === questionTextMode,
                  )?.description
                }
              </p>
              <div className="rounded-xl border bg-secondary p-4">
                <p
                  className={cn(
                    "whitespace-pre-wrap break-words font-serif text-lg font-bold italic leading-7",
                    questionTextMode === "hidden"
                      ? "text-muted-foreground"
                      : "text-foreground",
                  )}
                >
                  "{getQuestionPreviewText({
                    editedQuestionText: initialValues.editedQuestionText,
                    mode: questionTextMode,
                    questionText: editor.question.text,
                  })}"
                </p>
              </div>
              <FieldError
                id="questionTextMode-message"
                message={fieldErrors.questionTextMode}
              />
            </Field>

            {questionTextMode === "edited" ? (
              <Field
                data-invalid={
                  fieldErrors.editedQuestionText !== undefined ? true : undefined
                }
              >
                <FieldLabel htmlFor="editedQuestionText">
                  Edited question
                </FieldLabel>
                <Textarea
                  aria-describedby="editedQuestionText-description editedQuestionText-message"
                  aria-invalid={fieldErrors.editedQuestionText !== undefined}
                  defaultValue={initialValues.editedQuestionText}
                  id="editedQuestionText"
                  maxLength={500}
                  name="editedQuestionText"
                  rows={4}
                />
                <FieldDescription id="editedQuestionText-description">
                  500 characters max. The original remains private for context.
                </FieldDescription>
                <FieldError
                  id="editedQuestionText-message"
                  message={fieldErrors.editedQuestionText}
                />
              </Field>
            ) : (
              <input name="editedQuestionText" type="hidden" value="" />
            )}

            <Field data-invalid={fieldErrors.answerText !== undefined ? true : undefined}>
              <div className="flex items-center justify-between gap-4">
                <FieldLabel htmlFor="answerText">Answer</FieldLabel>
                <span
                  aria-live="polite"
                  className={cn(
                    "font-mono text-xs",
                    answerCharactersRemaining < 0
                      ? "text-destructive"
                      : "text-muted-foreground",
                  )}
                  id="answerText-counter"
                >
                  {formatCharacterCount(Math.max(answerCharactersRemaining, 0))} left
                </span>
              </div>
              <Textarea
                aria-describedby="answerText-description answerText-counter answerText-message"
                aria-invalid={fieldErrors.answerText !== undefined}
                className="scroll-mb-32"
                id="answerText"
                maxLength={answerCharacterLimit}
                name="answerText"
                onChange={(event) => {
                  setAnswerText(event.target.value);
                }}
                placeholder="Write the answer you will publish..."
                rows={4}
                value={answerText}
              />
              <FieldDescription id="answerText-description">
                3,000 characters max. Line breaks are preserved when published.
              </FieldDescription>
              <FieldError id="answerText-message" message={fieldErrors.answerText} />
            </Field>

            <Field
              data-invalid={
                fieldErrors.followUpPermissionOverride !== undefined
                  ? true
                  : undefined
              }
            >
              <FieldLabel htmlFor="followUpPermissionOverride">
                Follow-up override
              </FieldLabel>
              <select
                aria-describedby="followUpPermissionOverride-description followUpPermissionOverride-message"
                aria-invalid={
                  fieldErrors.followUpPermissionOverride !== undefined
                }
                className="flex h-10 w-full min-w-0 rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20"
                defaultValue={normalizeFollowUpPermissionOverride(
                  initialValues.followUpPermissionOverride,
                )}
                id="followUpPermissionOverride"
                name="followUpPermissionOverride"
              >
                <option value="">
                  Profile default: {getFollowUpPermissionShortLabel(editor.followUpPermissionDefault)}
                </option>
                {followUpPermissionOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <FieldDescription id="followUpPermissionOverride-description">
                Applies once this answer is published.
              </FieldDescription>
              <FieldError
                id="followUpPermissionOverride-message"
                message={fieldErrors.followUpPermissionOverride}
              />
            </Field>
          </fieldset>
        </FieldGroup>
      </Form>
      <footer className="shrink-0 border-t border-border/60 bg-secondary p-6 sm:p-8">
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-wrap gap-2">
            <QuestionModerationControls
              action="/dashboard/inbox"
              disabled={disabled}
              questionPublicId={editor.question.publicId}
              variant="inline"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PendingButton
              disabled={disabled}
              form={formId}
              name="intent"
              pendingText="Saving draft"
              size="sm"
              type="submit"
              value="save_draft"
              variant="outline"
            >
              <Save data-icon="inline-start" />
              Save draft
            </PendingButton>
            <PendingButton
              disabled={disabled}
              form={formId}
              name="intent"
              pendingText="Publishing"
              size="sm"
              type="submit"
              value="publish"
            >
              <Send data-icon="inline-start" />
              Publish answer
            </PendingButton>
          </div>
        </div>
      </footer>
    </section>
  );
}

function getAnswerActionToastMessage(
  result: AnswerActionResult | undefined,
  formError: string | undefined,
) {
  if (result?.status === "draft_saved") {
    return "Draft saved.";
  }

  return formError;
}

function QuestionSender({
  question,
}: {
  question: AnswerEditorViewData["question"];
}) {
  return (
    <div className="flex items-center justify-end gap-2 whitespace-nowrap font-mono text-[0.68rem] text-muted-foreground">
      <span className="rounded-full border bg-card px-3 py-1 font-bold text-foreground">
        {question.identity === "attributed" ? "Attributed" : "Anonymous"}
      </span>
      <span aria-hidden="true">·</span>
      <time dateTime={question.createdAt}>{formatDate(question.createdAt)}</time>
    </div>
  );
}

function FieldError({
  id,
  message,
}: {
  id: string;
  message: string | undefined;
}) {
  if (message === undefined) {
    return <span id={id} />;
  }

  return (
    <p className="text-sm leading-6 text-destructive" id={id} role="alert">
      {message}
    </p>
  );
}

function getFieldErrors(
  result: AnswerActionResult | undefined,
): AnswerFieldErrors {
  return result?.status === "invalid" ? result.fieldErrors : {};
}

function getFormError(result: AnswerActionResult | undefined) {
  if (result?.status === "invalid" || result?.status === "denied") {
    return result.formError;
  }

  return undefined;
}

function normalizeQuestionTextMode(
  value: AnswerFormValues["questionTextMode"],
): QuestionTextMode {
  if (value === "edited" || value === "hidden") {
    return value;
  }

  return "original";
}

function normalizeFollowUpPermissionOverride(
  value: AnswerFormValues["followUpPermissionOverride"],
) {
  return value === "unknown" || value === null ? "" : value;
}

function getQuestionPreviewText({
  editedQuestionText,
  mode,
  questionText,
}: {
  editedQuestionText: string;
  mode: QuestionTextMode;
  questionText: string;
}) {
  switch (mode) {
    case "edited":
      return editedQuestionText.trim() || questionText;
    case "hidden":
      return "Question hidden from published answer.";
    case "original":
      return questionText;
  }
}

function getFollowUpPermissionShortLabel(value: FollowUpPermission) {
  switch (value) {
    case "anyone":
      return "Anyone";
    case "logged_in":
      return "Logged in";
    case "original_asker":
      return "Original asker";
    case "off":
      return "Off";
  }
}

function formatCharacterCount(value: number) {
  return new Intl.NumberFormat("en").format(value);
}

function formatDate(value: string) {
  return formatMediumDateTime(value);
}
