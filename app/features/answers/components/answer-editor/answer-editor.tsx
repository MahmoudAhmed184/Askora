import { Eye, EyeOff, PencilLine, Send, Save } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Form, useFetcher } from "react-router";

import { ActionToast } from "~/components/shared/action-toast/action-toast";
import { PendingButton } from "~/components/shared/pending-button/pending-button";
import {
  AnonymousAvatar,
  ProfileIdentityLink,
} from "~/components/shared/profile-identity/profile-identity";

import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "~/components/ui/field/field";
import { Select } from "~/components/ui/select/select";
import { Textarea } from "~/components/ui/textarea/textarea";
import type {
  AnswerActionResult,
  AnswerEditorViewData,
  AnswerFieldErrors,
  AnswerFormValues,
} from "~/features/answers/types/answers.types";
import { QuestionModerationControls } from "~/features/inbox/components/question-moderation-controls";
import type { FollowUpPermission } from "~/features/settings/validations/settings.validations";
import { formatMediumDateTime } from "~/lib/date-format";
import { cn } from "~/lib/utils";

interface AnswerEditorProps {
  action?: string;
  actionResult?: AnswerActionResult | undefined;
  disabled: boolean;
  editor: AnswerEditorViewData;
  onDirtyChange?: (dirty: boolean) => void;
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
  action,
  actionResult,
  disabled,
  editor,
  onDirtyChange,
}: AnswerEditorProps) {
  const formId = useId();
  const fetcher = useFetcher<{ answer: AnswerActionResult }>();
  const contextualActionResult =
    action === undefined ? undefined : fetcher.data?.answer;
  const effectiveActionResult = contextualActionResult ?? actionResult;
  const initialValues = getInitialValues(actionResult, editor.values);
  const [values, setValues] = useState(initialValues);
  const [cleanValues, setCleanValues] = useState(initialValues);
  const previousActionResultRef = useRef<AnswerActionResult | undefined>(
    effectiveActionResult,
  );

  useEffect(() => {
    if (
      effectiveActionResult?.status === "invalid" ||
      effectiveActionResult?.status === "denied"
    ) {
      // Server validation is the external source of truth for these fields.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValues(effectiveActionResult.values);
    }
  }, [effectiveActionResult]);

  useEffect(() => {
    if (
      effectiveActionResult?.status === "draft_saved" &&
      previousActionResultRef.current !== effectiveActionResult
    ) {
      setCleanValues(values);
    }

    previousActionResultRef.current = effectiveActionResult;
  }, [effectiveActionResult, values]);

  useEffect(() => {
    onDirtyChange?.(!areAnswerValuesEqual(values, cleanValues));
  }, [cleanValues, onDirtyChange, values]);

  const fieldErrors = getFieldErrors(effectiveActionResult);
  const formError = getFormError(effectiveActionResult);
  const answerCharactersRemaining =
    answerCharacterLimit - values.answerText.length;
  const isSubmitting = action !== undefined && fetcher.state !== "idle";
  const FormComponent = action === undefined ? Form : fetcher.Form;

  return (
    <section
      aria-labelledby="answer-editor-title"
      className="flex max-h-full w-full max-w-[44rem] flex-col overflow-hidden rounded-3xl border bg-card text-card-foreground shadow-[var(--shadow-card)]"
    >
      <ActionToast
        message={getAnswerActionToastMessage(effectiveActionResult, formError)}
        tone={
          effectiveActionResult?.status === "draft_saved" ? "success" : "error"
        }
        trigger={effectiveActionResult}
      />
      <h1 className="sr-only" id="answer-editor-title">
        Answer question
      </h1>
      <FormComponent
        {...(action === undefined ? {} : { action })}
        aria-label="Answer editor"
        className="min-h-0 flex-1 overflow-y-auto"
        id={formId}
        method="post"
      >
        <FieldGroup className="gap-5 p-5 sm:p-6">
          <fieldset className="contents" disabled={disabled}>
            <QuestionContext question={editor.question} />

            <Field
              data-invalid={
                fieldErrors.questionTextMode !== undefined ? true : undefined
              }
            >
              <FieldLabel id="public-question-wording-label">
                Public question wording
              </FieldLabel>
              <div
                aria-labelledby="public-question-wording-label"
                className="flex flex-wrap gap-2"
                role="radiogroup"
              >
                {questionTextModeOptions.map((option) => {
                  const Icon = option.icon;
                  return (
                    <label
                      className={cn(
                        "inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm font-bold transition-[background-color,border-color,color,box-shadow]",
                        values.questionTextMode === option.value
                          ? "border-primary bg-primary text-primary-foreground shadow-[0_4px_12px_var(--accent-glow)]"
                          : "bg-card text-foreground hover:border-primary/40",
                      )}
                      key={option.value}
                    >
                      <input
                        checked={values.questionTextMode === option.value}
                        className="sr-only"
                        name="questionTextMode"
                        onChange={() => {
                          setValues((current) => ({
                            ...current,
                            questionTextMode: option.value,
                          }));
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
                    (option) => option.value === values.questionTextMode,
                  )?.description
                }
              </p>
              <FieldError
                id="questionTextMode-message"
                message={fieldErrors.questionTextMode}
              />
            </Field>

            {values.questionTextMode === "edited" ? (
              <Field
                data-invalid={
                  fieldErrors.editedQuestionText !== undefined
                    ? true
                    : undefined
                }
              >
                <FieldLabel htmlFor="editedQuestionText">
                  Edited question
                </FieldLabel>
                <Textarea
                  aria-describedby="editedQuestionText-description editedQuestionText-message"
                  aria-invalid={fieldErrors.editedQuestionText !== undefined}
                  id="editedQuestionText"
                  maxLength={500}
                  name="editedQuestionText"
                  onChange={(event) => {
                    setValues((current) => ({
                      ...current,
                      editedQuestionText: event.target.value,
                    }));
                  }}
                  rows={4}
                  value={values.editedQuestionText}
                />
                <FieldDescription id="editedQuestionText-description">
                  Published in place of the original wording. 500 characters
                  max; the original remains private for context.
                </FieldDescription>
                <FieldError
                  id="editedQuestionText-message"
                  message={fieldErrors.editedQuestionText}
                />
              </Field>
            ) : (
              // Keeps the typed draft in the submission while the field is
              // hidden, so switching modes back restores the same text.
              <input
                name="editedQuestionText"
                type="hidden"
                value={values.editedQuestionText}
              />
            )}

            <Field
              data-invalid={
                fieldErrors.answerText !== undefined ? true : undefined
              }
            >
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
                  {formatCharacterCount(Math.max(answerCharactersRemaining, 0))}{" "}
                  left
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
                  setValues((current) => ({
                    ...current,
                    answerText: event.target.value,
                  }));
                }}
                placeholder="Write the answer you will publish..."
                rows={4}
                value={values.answerText}
              />
              <FieldDescription id="answerText-description">
                3,000 characters max. Line breaks are preserved when published.
              </FieldDescription>
              <FieldError
                id="answerText-message"
                message={fieldErrors.answerText}
              />
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
              <Select
                aria-describedby="followUpPermissionOverride-description followUpPermissionOverride-message"
                aria-invalid={
                  fieldErrors.followUpPermissionOverride !== undefined
                }
                id="followUpPermissionOverride"
                name="followUpPermissionOverride"
                onChange={(event) => {
                  setValues((current) => ({
                    ...current,
                    followUpPermissionOverride:
                      event.target.value === ""
                        ? null
                        : (event.target
                            .value as AnswerFormValues["followUpPermissionOverride"]),
                  }));
                }}
                value={normalizeFollowUpPermissionOverride(
                  values.followUpPermissionOverride,
                )}
              >
                <option value="">
                  Profile default:{" "}
                  {getFollowUpPermissionShortLabel(
                    editor.followUpPermissionDefault,
                  )}
                </option>
                {followUpPermissionOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
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
      </FormComponent>
      <footer className="shrink-0 border-t border-border/60 bg-secondary p-4 sm:p-5">
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-wrap gap-2">
            <QuestionModerationControls
              action="/inbox"
              disabled={disabled || isSubmitting}
              questionPublicId={editor.question.publicId}
              variant="inline"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PendingButton
              disabled={disabled || isSubmitting}
              form={formId}
              name="intent"
              pending={
                isSubmitting && fetcher.formData?.get("intent") === "save_draft"
              }
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
              disabled={disabled || isSubmitting}
              form={formId}
              name="intent"
              pending={
                isSubmitting && fetcher.formData?.get("intent") === "publish"
              }
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

function getInitialValues(
  actionResult: AnswerActionResult | undefined,
  editorValues: AnswerFormValues,
) {
  return actionResult?.status === "invalid" || actionResult?.status === "denied"
    ? actionResult.values
    : editorValues;
}

function areAnswerValuesEqual(left: AnswerFormValues, right: AnswerFormValues) {
  return (
    left.answerText === right.answerText &&
    left.questionTextMode === right.questionTextMode &&
    left.editedQuestionText === right.editedQuestionText &&
    left.followUpPermissionOverride === right.followUpPermissionOverride
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

function QuestionContext({
  question,
}: {
  question: AnswerEditorViewData["question"];
}) {
  const timestamp = (
    <>
      <span aria-hidden="true">·</span>
      <time dateTime={question.createdAt}>{formatDate(question.createdAt)}</time>
    </>
  );

  return (
    <div className="rounded-2xl border bg-secondary/70 p-4">
      <p className="mb-3 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-primary">
        Question from
      </p>
      {question.sender === undefined ? (
        <div className="flex min-w-0 items-center gap-3">
          <AnonymousAvatar />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="font-semibold leading-tight text-foreground">
              Anonymous
            </span>
            <div className="flex flex-wrap items-center gap-x-2 font-mono text-xs text-muted-foreground">
              <span>Sender hidden</span>
              {timestamp}
            </div>
          </div>
          <IdentityBadge label="Anonymous" />
        </div>
      ) : (
        <ProfileIdentityLink
          meta={timestamp}
          profile={question.sender}
          trailing={<IdentityBadge label="Attributed" />}
        />
      )}
      <p className="mt-4 whitespace-pre-wrap break-words border-t border-dashed pt-4 font-serif text-lg font-bold italic leading-7 text-foreground">
        {question.text}
      </p>
    </div>
  );
}

function IdentityBadge({ label }: { label: "Anonymous" | "Attributed" }) {
  return (
    <span className="shrink-0 rounded-full border bg-card px-2.5 py-1 font-mono text-[0.65rem] font-bold text-muted-foreground">
      {label}
    </span>
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

function normalizeFollowUpPermissionOverride(
  value: AnswerFormValues["followUpPermissionOverride"],
) {
  return value === "unknown" || value === null ? "" : value;
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
