import { CheckCircle2, Eye, EyeOff, PencilLine, Send, Save } from "lucide-react";
import { useState } from "react";
import { Form } from "react-router";

import { PendingButton } from "~/components/app/pending-button";
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
import type { FollowUpPermission } from "~/features/settings/settings.schema";
import { cn } from "~/lib/utils";

interface AnswerEditorProps {
  actionResult: AnswerActionResult | undefined;
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

export function AnswerEditor({
  actionResult,
  disabled,
  editor,
}: AnswerEditorProps) {
  const initialValues =
    actionResult?.status === "invalid" || actionResult?.status === "denied"
      ? actionResult.values
      : editor.values;
  const [questionTextMode, setQuestionTextMode] = useState(
    normalizeQuestionTextMode(initialValues.questionTextMode),
  );
  const fieldErrors = getFieldErrors(actionResult);
  const formError = getFormError(actionResult);

  return (
    <div className="flex flex-col gap-6">
      <section
        aria-label="Question"
        className="rounded-lg border bg-card p-5 text-card-foreground shadow-sm"
      >
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>
            {editor.question.identity === "attributed"
              ? "Attributed"
              : "Anonymous"}
          </span>
          <span aria-hidden="true">/</span>
          <time dateTime={editor.question.createdAt}>
            {formatDate(editor.question.createdAt)}
          </time>
        </div>
        <p className="whitespace-pre-wrap break-words text-base leading-7">
          {editor.question.text}
        </p>
      </section>

      <Form aria-label="Answer editor" className="border-y py-6" method="post">
        <FieldGroup className="gap-5">
          {formError === undefined ? undefined : (
            <p className="text-sm leading-6 text-destructive" role="alert">
              {formError}
            </p>
          )}

          {actionResult?.status === "draft_saved" ? (
            <p className="flex items-start gap-2 text-sm leading-6 text-muted-foreground" role="status">
              <CheckCircle2
                aria-hidden="true"
                className="mt-1 size-4 shrink-0 text-foreground"
              />
              Draft saved.
            </p>
          ) : undefined}

          <fieldset className="contents" disabled={disabled}>
            <Field data-invalid={fieldErrors.answerText !== undefined ? true : undefined}>
              <FieldLabel htmlFor="answerText">Answer</FieldLabel>
              <Textarea
                aria-describedby="answerText-description answerText-message"
                aria-invalid={fieldErrors.answerText !== undefined}
                defaultValue={initialValues.answerText}
                id="answerText"
                maxLength={3_000}
                name="answerText"
                placeholder="Write a plain-text answer"
                rows={10}
              />
              <FieldDescription id="answerText-description">
                3,000 characters max. Line breaks are preserved when published.
              </FieldDescription>
              <FieldError id="answerText-message" message={fieldErrors.answerText} />
            </Field>

            <Field
              data-invalid={
                fieldErrors.questionTextMode !== undefined ? true : undefined
              }
            >
              <span className="text-sm font-medium leading-none">
                Public question text
              </span>
              <div className="grid gap-2 md:grid-cols-3">
                {questionTextModeOptions.map((option) => {
                  const Icon = option.icon;
                  return (
                    <label
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-md border bg-background p-3 text-sm transition-colors",
                        questionTextMode === option.value
                          ? "border-foreground"
                          : "hover:border-ring",
                      )}
                      key={option.value}
                    >
                      <input
                        checked={questionTextMode === option.value}
                        className="mt-1 size-4 accent-primary"
                        name="questionTextMode"
                        onChange={() => {
                          setQuestionTextMode(option.value);
                        }}
                        type="radio"
                        value={option.value}
                      />
                      <span>
                        <span className="flex items-center gap-2 font-medium">
                          <Icon aria-hidden="true" className="size-4" />
                          {option.label}
                        </span>
                        <span className="mt-1 block leading-6 text-muted-foreground">
                          {option.description}
                        </span>
                      </span>
                    </label>
                  );
                })}
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
                className="flex h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20"
                defaultValue={normalizeFollowUpPermissionOverride(
                  initialValues.followUpPermissionOverride,
                )}
                id="followUpPermissionOverride"
                name="followUpPermissionOverride"
              >
                <option value="">
                  Use profile default ({getFollowUpPermissionLabel(editor.followUpPermissionDefault)})
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

          <div className="flex flex-wrap items-center gap-2">
            <PendingButton
              disabled={disabled}
              name="intent"
              pendingText="Saving draft"
              type="submit"
              value="save_draft"
              variant="outline"
            >
              <Save data-icon="inline-start" />
              Save draft
            </PendingButton>
            <PendingButton
              disabled={disabled}
              name="intent"
              pendingText="Publishing"
              type="submit"
              value="publish"
            >
              <Send data-icon="inline-start" />
              Publish
            </PendingButton>
          </div>
        </FieldGroup>
      </Form>
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

function getFollowUpPermissionLabel(value: FollowUpPermission) {
  return (
    followUpPermissionOptions.find((option) => option.value === value)?.label ??
    value
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
