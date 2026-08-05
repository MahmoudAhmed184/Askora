import { LoaderCircle, Sparkles } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Link, useFetcher, useRevalidator } from "react-router";

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
  const revalidator = useRevalidator();
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
      void revalidator.revalidate();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [result, revalidator]);

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
        <Sparkles data-icon="inline-start" />
        Generate questions
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
          className="max-h-[100svh] w-full max-w-lg rounded-b-none sm:max-h-[calc(100svh-2rem)] sm:rounded-2xl"
          onEscapeKeyDown={(event) => {
            if (isPending) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (isPending) event.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>Generate questions</DialogTitle>
            <DialogDescription>
              New questions go directly to your private inbox. You can answer or remove them there.
            </DialogDescription>
          </DialogHeader>

          {!isConfigured ? (
            <div className="rounded-xl border border-dashed p-4 text-sm leading-6 text-muted-foreground">
              {!availability.connected
                ? "Connect Gemini before generating questions."
                : "Acknowledge the data-use disclosure before generating questions."}{" "}
              <Link className="font-medium text-primary underline-offset-4 hover:underline" to="/settings/question-generation">
                Open Question generation settings
              </Link>
            </div>
          ) : (
            <fetcher.Form aria-label="Generate questions" className="flex flex-col gap-4" method="post">
              <input name="intent" type="hidden" value="generate_questions" />
              <Field>
                <FieldLabel htmlFor={topicId}>What would you like questions about today?</FieldLabel>
                <Input
                  aria-describedby={errorId}
                  dir="auto"
                  disabled={isPending}
                  id={topicId}
                  maxLength={160}
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
              <p className="text-sm text-muted-foreground">Active model: {availability.activeModelLabel}</p>
              <FieldError id={errorId} message={result?.status === "generated" ? undefined : result?.formError} />
              <p aria-live="polite" className="sr-only">
                {isPending ? "Generating questions. Please wait." : result?.status === "generated" ? `${String(result.questions.length)} questions added to your inbox.` : result?.formError}
              </p>
              <DialogFooter>
                <Button disabled={isPending} onClick={() => {
                  setOpen(false);
                }} type="button" variant="outline">Cancel</Button>
                <Button disabled={isPending} type="submit">
                  {isPending ? <LoaderCircle className="animate-spin motion-reduce:animate-none" data-icon="inline-start" /> : <Sparkles data-icon="inline-start" />}
                  {isPending ? "Generating questions" : "Generate questions"}
                </Button>
              </DialogFooter>
            </fetcher.Form>
          )}
        </DialogContent>
      </Dialog>

      <ActionToast
        message={result?.status === "generated" ? `${String(result.questions.length)} questions added to your inbox.` : undefined}
        tone="success"
        trigger={result}
      />
    </>
  );
}
