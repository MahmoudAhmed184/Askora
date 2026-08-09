import { ListPlus, LoaderCircle, MessageCircleQuestion } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Link, useFetcher } from "react-router";

import { ActionToast } from "~/components/shared/action-toast/action-toast";
import { Button } from "~/components/ui/button/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog/dialog";
import { Field, FieldError, FieldLabel } from "~/components/ui/field/field";
import { Input } from "~/components/ui/input/input";
import { Select } from "~/components/ui/select/select";
import {
  questionGenerationLanguageValues,
  questionGenerationRequestedCountValues,
  questionGenerationStyleValues,
  type QuestionGenerationLanguage,
  type QuestionGenerationRequestedCount,
  type QuestionGenerationStyle,
} from "~/features/question-generation/question-generation.constants";

export interface InboxGenerationAvailability {
  connected: boolean;
  disclosureAcknowledged: boolean;
  activeModelLabel: string;
}

export type InboxGenerationActionResult =
  | {
      status: "generated";
      questions: { id: string; publicId: string; text: string }[];
    }
  | {
      status: "invalid" | "failed";
      formError: string;
      retryAfterSeconds?: number;
    };

interface InboxGenerationFetcherData {
  generation: InboxGenerationActionResult;
}

const languageLabels: Record<QuestionGenerationLanguage, string> = {
  egyptian_arabic: "Egyptian Arabic",
  modern_standard_arabic: "Modern Standard Arabic",
  english: "English",
};

const styleLabels: Record<QuestionGenerationStyle, string> = {
  balanced: "Balanced",
  deep_reflective: "Deep and reflective",
  professional: "Professional",
  personal: "Personal",
  light_fun: "Light and fun",
  surprise_me: "Surprise me",
};

export function InboxQuestionGenerationDialog({
  availability,
  disabled = false,
}: {
  availability: InboxGenerationAvailability;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [language, setLanguage] = useState<QuestionGenerationLanguage>("english");
  const [style, setStyle] = useState<QuestionGenerationStyle>("balanced");
  const [requestedCount, setRequestedCount] = useState<QuestionGenerationRequestedCount>(5);
  const fetcher = useFetcher<InboxGenerationFetcherData>();
  const result = fetcher.data?.generation;
  const isPending = fetcher.state !== "idle";
  const isConfigured = availability.connected && availability.disclosureAcknowledged;
  const topicId = useId();
  const languageId = useId();
  const styleId = useId();
  const countId = useId();
  const errorId = useId();
  const handledSuccess = useRef<InboxGenerationActionResult | undefined>(undefined);

  useEffect(() => {
    if (result?.status !== "generated" || handledSuccess.current === result) {
      return;
    }

    handledSuccess.current = result;

    const timeoutId = window.setTimeout(() => {
      setOpen(false);
      setTopic("");
      setLanguage("english");
      setStyle("balanced");
      setRequestedCount(5);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [result]);

  return (
    <>
      <Button
        disabled={disabled}
        onClick={() => {
          setOpen(true);
        }}
        size="lg"
        type="button"
      >
        <MessageCircleQuestion data-icon="inline-start" />
        Get Questions
      </Button>

      <Dialog
        onOpenChange={(nextOpen) => {
          if (!isPending) {
            setOpen(nextOpen);
          }
        }}
        open={open}
      >
        <DialogContent
          className="bottom-0 left-0 top-auto max-h-[100svh] w-full max-w-none translate-x-0 translate-y-0 rounded-b-none rounded-t-3xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[calc(100svh-2rem)] sm:w-[calc(100%-2rem)] sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:p-5"
          onEscapeKeyDown={(event) => {
            if (isPending) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (isPending) event.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>Get Questions</DialogTitle>
            <DialogDescription>
              Choose what you want to talk about. Askora will add private questions to your inbox.
            </DialogDescription>
          </DialogHeader>

          {!isConfigured ? (
            <>
              <div className="rounded-xl border border-dashed p-4 text-sm leading-6 text-muted-foreground">
                {!availability.connected
                  ? "Connect Gemini to get questions."
                  : "Review the data-use note to get questions."}{" "}
                <Link className="font-medium text-primary underline-offset-4 hover:underline" to="/settings/question-generation">
                  Open Question Preferences
                </Link>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => {
                    setOpen(false);
                  }}
                  type="button"
                  variant="outline"
                >
                  Cancel
                </Button>
              </DialogFooter>
            </>
          ) : (
            <fetcher.Form aria-label="Get Questions" className="flex flex-col gap-4" method="post">
              <input name="intent" type="hidden" value="generate_questions" />
              <Field>
                <FieldLabel htmlFor={topicId}>What do you want to talk about?</FieldLabel>
                <Input
                  aria-describedby={errorId}
                  dir="auto"
                  disabled={isPending}
                  id={topicId}
                  name="topic"
                  onChange={(event) => {
                    setTopic(event.target.value);
                  }}
                  value={topic}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={languageId}>Language</FieldLabel>
                <Select disabled={isPending} id={languageId} name="language" onValueChange={(value) => {
                  setLanguage(value as QuestionGenerationLanguage);
                }} value={language}>
                  {questionGenerationLanguageValues.map((value) => <option key={value} value={value}>{languageLabels[value]}</option>)}
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor={styleId}>Style</FieldLabel>
                <Select disabled={isPending} id={styleId} name="style" onValueChange={(value) => {
                  setStyle(value as QuestionGenerationStyle);
                }} value={style}>
                  {questionGenerationStyleValues.map((value) => <option key={value} value={value}>{styleLabels[value]}</option>)}
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor={countId}>Quantity</FieldLabel>
                <Select disabled={isPending} id={countId} name="requestedCount" onValueChange={(value) => {
                  setRequestedCount(Number(value) as QuestionGenerationRequestedCount);
                }} value={requestedCount}>
                  {questionGenerationRequestedCountValues.map((value) => <option key={value} value={value}>{value}</option>)}
                </Select>
              </Field>
              <p className="text-sm text-muted-foreground">Model: {availability.activeModelLabel}</p>
              <FieldError
                id={errorId}
                message={
                  result?.status === "generated"
                    ? undefined
                    : result === undefined
                      ? undefined
                      : appendRetryAfter(result.formError, result.retryAfterSeconds)
                }
              />
              <p aria-live="polite" className="sr-only">
                {isPending
                  ? "Creating questions. Please wait."
                  : result?.status === "generated"
                    ? formatGeneratedMessage(result.questions.length)
                    : result === undefined
                      ? undefined
                      : appendRetryAfter(result.formError, result.retryAfterSeconds)}
              </p>
              <DialogFooter>
                <Button disabled={isPending} onClick={() => {
                  setOpen(false);
                }} type="button" variant="outline">Cancel</Button>
                <Button disabled={isPending} type="submit">
                  {isPending ? <LoaderCircle className="animate-spin motion-reduce:animate-none" data-icon="inline-start" /> : <ListPlus data-icon="inline-start" />}
                  {isPending ? "Getting questions" : "Get Questions"}
                </Button>
              </DialogFooter>
            </fetcher.Form>
          )}
        </DialogContent>
      </Dialog>

      <ActionToast
        message={
          result?.status === "generated"
            ? formatGeneratedMessage(result.questions.length)
            : result === undefined
              ? undefined
              : appendRetryAfter(result.formError, result.retryAfterSeconds)
        }
        tone={result?.status === "generated" ? "success" : "error"}
        trigger={result}
      />
    </>
  );
}

function appendRetryAfter(message: string, retryAfterSeconds: number | undefined) {
  if (retryAfterSeconds === undefined) {
    return message;
  }

  return `${message} Try again in ${formatRetryAfter(retryAfterSeconds)}.`;
}

function formatGeneratedMessage(questionCount: number) {
  return questionCount === 1
    ? "1 new question is in your inbox."
    : `${String(questionCount)} new questions are in your inbox.`;
}

function formatRetryAfter(seconds: number) {
  if (seconds < 60) {
    return `${String(seconds)} seconds`;
  }

  const minutes = Math.ceil(seconds / 60);
  return `${String(minutes)} minute${minutes === 1 ? "" : "s"}`;
}
