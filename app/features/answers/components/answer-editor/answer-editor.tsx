import { PencilLine, Send, X } from "lucide-react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Form, useFetcher } from "react-router";

import { ActionToast } from "~/components/shared/action-toast/action-toast";
import { PendingButton } from "~/components/shared/pending-button/pending-button";
import {
  AnonymousAvatar,
  ProfileIdentityLink,
} from "~/components/shared/profile-identity/profile-identity";

import { Button } from "~/components/ui/button/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "~/components/ui/field/field";
import { Textarea } from "~/components/ui/textarea/textarea";
import { FollowUpPermissionControl } from "~/features/answers/components/answer-editor/follow-up-permission-control";
import { QuestionWordingControl } from "~/features/answers/components/answer-editor/question-wording-control";
import type {
  AnswerActionResult,
  AnswerEditorViewData,
  AnswerFieldErrors,
  AnswerFormValues,
} from "~/features/answers/types/answers.types";
import type { QuestionTextMode } from "~/features/answers/validations/answer.validations";
import { formatMediumDateTime } from "~/lib/date-format";
import { cn } from "~/lib/utils";

interface AnswerEditorProps {
  action?: string;
  actionResult?: AnswerActionResult | undefined;
  disabled: boolean;
  editor: AnswerEditorViewData;
  onDraftSavedBeforeClose?: (() => void) | undefined;
}

export interface AnswerEditorHandle {
  saveDraftBeforeClose: () => boolean;
}

interface QuestionEditSnapshot {
  editedQuestionText: string;
  questionTextMode: AnswerFormValues["questionTextMode"];
}

const answerCharacterLimit = 3_000;

export const AnswerEditor = forwardRef<AnswerEditorHandle, AnswerEditorProps>(
  function AnswerEditor(
    { action, actionResult, disabled, editor, onDraftSavedBeforeClose },
    ref,
  ) {
    const formId = useId();
    const fetcher = useFetcher<{ answer: AnswerActionResult }>();
    const draftActionResult = fetcher.data?.answer;
    const effectiveActionResult = actionResult ?? draftActionResult;
    const initialValues = getInitialValues(actionResult, editor.values);
    const [values, setValues] = useState(initialValues);
    const [cleanValues, setCleanValues] = useState(initialValues);
    const [questionEditSnapshot, setQuestionEditSnapshot] =
      useState<QuestionEditSnapshot>();
    const closeAfterDraftSaveRef = useRef(false);
    const submittedDraftRef = useRef<AnswerFormValues | undefined>(undefined);
    const previousDraftActionResultRef = useRef<AnswerActionResult | undefined>(
      draftActionResult,
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

    const fieldErrors = getFieldErrors(effectiveActionResult);
    const formError = getFormError(effectiveActionResult);
    const answerCharactersRemaining =
      answerCharacterLimit - values.answerText.length;
    const isSubmitting = fetcher.state !== "idle";
    const FormComponent = action === undefined ? Form : fetcher.Form;
    const submitDraftValues = useCallback(
      (draftValues: AnswerFormValues) => {
        submittedDraftRef.current = draftValues;
        void fetcher.submit(createDraftFormData(draftValues), {
          ...(action === undefined ? {} : { action }),
          method: "post",
        });
      },
      [action, fetcher],
    );
    const saveDraftIfNeeded = useCallback(
      (closeAfterSave: boolean) => {
        if (
          values.answerText.trim().length === 0 ||
          areAnswerValuesEqual(values, cleanValues)
        ) {
          return false;
        }

        if (
          fetcher.state !== "idle" &&
          fetcher.formData?.get("intent") === "publish"
        ) {
          return true;
        }

        closeAfterDraftSaveRef.current = closeAfterSave;

        if (
          fetcher.state !== "idle" &&
          submittedDraftRef.current !== undefined &&
          areAnswerValuesEqual(values, submittedDraftRef.current)
        ) {
          return true;
        }

        submitDraftValues(values);
        return true;
      },
      [cleanValues, fetcher.formData, fetcher.state, submitDraftValues, values],
    );

    useImperativeHandle(
      ref,
      () => ({
        saveDraftBeforeClose: () => saveDraftIfNeeded(true),
      }),
      [saveDraftIfNeeded],
    );

    useEffect(() => {
      const isNewResult =
        previousDraftActionResultRef.current !== draftActionResult;

      if (draftActionResult?.status === "draft_saved" && isNewResult) {
        const savedValues = submittedDraftRef.current;

        if (savedValues !== undefined) {
          setCleanValues(savedValues);
        }

        if (closeAfterDraftSaveRef.current) {
          if (
            savedValues !== undefined &&
            values.answerText.trim().length > 0 &&
            !areAnswerValuesEqual(values, savedValues)
          ) {
            submitDraftValues(values);
          } else {
            closeAfterDraftSaveRef.current = false;
            onDraftSavedBeforeClose?.();
          }
        }
      } else if (
        isNewResult &&
        (draftActionResult?.status === "invalid" ||
          draftActionResult?.status === "denied")
      ) {
        closeAfterDraftSaveRef.current = false;
      }

      previousDraftActionResultRef.current = draftActionResult;
    }, [draftActionResult, onDraftSavedBeforeClose, submitDraftValues, values]);

    const changeQuestionTextMode = (questionTextMode: QuestionTextMode) => {
      setQuestionEditSnapshot(undefined);
      setValues((current) => ({
        ...current,
        questionTextMode,
      }));
    };
    const startQuestionEditing = () => {
      setQuestionEditSnapshot({
        editedQuestionText: values.editedQuestionText,
        questionTextMode: values.questionTextMode,
      });
      setValues((current) => ({
        ...current,
        questionTextMode: "edited",
        editedQuestionText:
          current.editedQuestionText.length === 0
            ? editor.question.text
            : current.editedQuestionText,
      }));
    };
    const cancelQuestionEditing = () => {
      if (questionEditSnapshot === undefined) {
        return;
      }

      setValues((current) => ({
        ...current,
        ...questionEditSnapshot,
      }));
      setQuestionEditSnapshot(undefined);
    };

    return (
      <section
        aria-labelledby="answer-editor-title"
        className="flex max-h-full w-full max-w-[44rem] flex-col overflow-hidden rounded-3xl border bg-card text-card-foreground shadow-[var(--shadow-card)]"
      >
        <ActionToast
          message={getAnswerActionToastMessage(
            effectiveActionResult,
            formError,
          )}
          tone={
            effectiveActionResult?.status === "draft_saved"
              ? "success"
              : "error"
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
              <QuestionContext
                editedQuestionError={fieldErrors.editedQuestionText}
                editedQuestionText={values.editedQuestionText}
                isEditingQuestion={questionEditSnapshot !== undefined}
                onCancelQuestionEditing={cancelQuestionEditing}
                onEditQuestion={startQuestionEditing}
                onEditedQuestionChange={(editedQuestionText) => {
                  setValues((current) => ({
                    ...current,
                    editedQuestionText,
                  }));
                }}
                question={editor.question}
              />

              <QuestionWordingControl
                error={fieldErrors.questionTextMode}
                onChange={changeQuestionTextMode}
                value={values.questionTextMode}
              />

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
                    {formatCharacterCount(
                      Math.max(answerCharactersRemaining, 0),
                    )}{" "}
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
                  onBlur={(event) => {
                    if (
                      event.relatedTarget instanceof HTMLButtonElement &&
                      event.relatedTarget.type === "submit"
                    ) {
                      return;
                    }

                    saveDraftIfNeeded(false);
                  }}
                  placeholder="Write the answer you will publish..."
                  rows={4}
                  value={values.answerText}
                />
                <FieldDescription id="answerText-description">
                  3,000 characters max. Line breaks are preserved when
                  published.
                </FieldDescription>
                <FieldError
                  id="answerText-message"
                  message={fieldErrors.answerText}
                />
              </Field>

              <FollowUpPermissionControl
                defaultPermission={editor.followUpPermissionDefault}
                error={fieldErrors.followUpPermissionOverride}
                onChange={(followUpPermissionOverride) => {
                  setValues((current) => ({
                    ...current,
                    followUpPermissionOverride,
                  }));
                }}
                value={values.followUpPermissionOverride}
              />
            </fieldset>
          </FieldGroup>
        </FormComponent>
        <footer className="shrink-0 border-t border-border/60 bg-secondary p-4 sm:p-5">
          <div className="flex justify-end">
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
        </footer>
      </section>
    );
  },
);

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
  editedQuestionError,
  editedQuestionText,
  isEditingQuestion,
  onCancelQuestionEditing,
  onEditQuestion,
  onEditedQuestionChange,
  question,
}: {
  editedQuestionError?: string | undefined;
  editedQuestionText: string;
  isEditingQuestion: boolean;
  onCancelQuestionEditing: () => void;
  onEditQuestion: () => void;
  onEditedQuestionChange: (value: string) => void;
  question: AnswerEditorViewData["question"];
}) {
  const timestamp = (
    <>
      <span aria-hidden="true">·</span>
      <time dateTime={question.createdAt}>
        {formatDate(question.createdAt)}
      </time>
    </>
  );

  return (
    <div className="rounded-2xl border bg-secondary/70 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-primary">
          Question from
        </p>
        {isEditingQuestion ? (
          <Button
            aria-label="Cancel editing"
            onClick={onCancelQuestionEditing}
            size="lg"
            type="button"
            variant="ghost"
          >
            <X aria-hidden="true" data-icon="inline-start" />
            Cancel
          </Button>
        ) : (
          <Button
            aria-label="Edit public question wording"
            className="size-11 p-0"
            onClick={onEditQuestion}
            size="lg"
            title="Edit public question wording"
            type="button"
            variant="ghost"
          >
            <PencilLine aria-hidden="true" data-icon="inline-start" />
          </Button>
        )}
      </div>
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
      {isEditingQuestion ? (
        <Field
          className="mt-4 border-t border-dashed pt-4"
          data-invalid={editedQuestionError === undefined ? undefined : true}
        >
          <FieldLabel className="sr-only" htmlFor="editedQuestionText">
            Edited question
          </FieldLabel>
          <Textarea
            aria-describedby="editedQuestionText-description editedQuestionText-message"
            aria-invalid={editedQuestionError !== undefined}
            autoFocus
            className="font-serif text-lg font-bold italic leading-7"
            dir={question.direction}
            id="editedQuestionText"
            maxLength={500}
            name="editedQuestionText"
            onChange={(event) => {
              onEditedQuestionChange(event.target.value);
            }}
            rows={3}
            value={editedQuestionText}
          />
          <div className="flex items-start justify-between gap-3">
            <FieldDescription
              className="text-xs leading-5"
              id="editedQuestionText-description"
            >
              Published wording. The original stays private.
            </FieldDescription>
            <span className="shrink-0 font-mono text-xs text-muted-foreground">
              {formatCharacterCount(editedQuestionText.length)}/500
            </span>
          </div>
          <FieldError
            id="editedQuestionText-message"
            message={editedQuestionError}
          />
        </Field>
      ) : (
        <>
          <input
            name="editedQuestionText"
            type="hidden"
            value={editedQuestionText}
          />
          <p
            className="mt-4 whitespace-pre-wrap break-words border-t border-dashed pt-4 font-serif text-lg font-bold italic leading-7 text-foreground"
            dir={question.direction}
          >
            {question.text}
          </p>
        </>
      )}
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

function formatCharacterCount(value: number) {
  return new Intl.NumberFormat("en").format(value);
}

function createDraftFormData(values: AnswerFormValues) {
  const formData = new FormData();
  formData.set("intent", "save_draft");
  formData.set("answerText", values.answerText);
  formData.set("questionTextMode", values.questionTextMode);
  formData.set("editedQuestionText", values.editedQuestionText);
  formData.set(
    "followUpPermissionOverride",
    values.followUpPermissionOverride === "unknown" ||
      values.followUpPermissionOverride === null
      ? ""
      : values.followUpPermissionOverride,
  );

  return formData;
}

function formatDate(value: string) {
  return formatMediumDateTime(value);
}
