import { Mail, Send } from "lucide-react";
import { useRef } from "react";
import { Form } from "react-router";

import { ActionToast } from "~/components/shared/action-toast/action-toast";
import { PendingButton } from "~/components/shared/pending-button/pending-button";
import { Button } from "~/components/ui/button/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "~/components/ui/field/field";
import { Textarea } from "~/components/ui/textarea/textarea";
import type { PublicAskStateAllowed } from "~/features/profiles/types/profiles.types";
import type { PublicAskFlash } from "~/features/profiles/types/profiles.types";
import type { PublicProfileView } from "~/features/profiles/types/profiles.types";
import { cn } from "~/lib/utils";

interface AskComposerProps {
  ask: PublicAskStateAllowed;
  flash: PublicAskFlash | undefined;
  profile: PublicProfileView;
  timingToken: string;
}

const publicPromptSuggestions = [
  "What changed your mind recently?",
  "What are you tired of pretending?",
  "What advice aged badly?",
  "What feels easier now?",
] as const;

const promptSuggestionTilt = [
  "-rotate-2",
  "rotate-1",
  "-rotate-1",
  "rotate-2",
] as const;

export function AskComposer({
  ask,
  flash,
  profile,
  timingToken,
}: AskComposerProps) {
  const error = flash?.status === "error" ? flash : undefined;
  const questionRef = useRef<HTMLTextAreaElement>(null);

  function applyPromptSuggestion(prompt: string) {
    const question = questionRef.current;

    if (question === null) {
      return;
    }

    question.value = prompt;
    question.focus();
    question.setSelectionRange(prompt.length, prompt.length);
    question.dispatchEvent(new Event("input", { bubbles: true }));
  }

  return (
    <section
      aria-label="Public ask form"
      className="overflow-hidden rounded-3xl border bg-card text-card-foreground shadow-[var(--shadow-card)] transition-[border-color,box-shadow,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] focus-within:-translate-y-px focus-within:border-primary focus-within:shadow-[var(--shadow-card),0_0_0_3px_var(--accent-glow)] motion-reduce:transition-none motion-reduce:focus-within:translate-y-0"
      id="ask"
    >
      <ActionToast
        description={flash?.status === "success" ? flash.prompt : undefined}
        message={getAskToastMessage(flash)}
        tone={flash?.status === "success" ? "success" : "error"}
        trigger={flash}
      />
      <Form action={`/${profile.username}/questions`} method="post" replace>
        <FieldGroup className="gap-0">
          <div className="flex items-center justify-between gap-3 border-b bg-secondary px-5 py-3.5">
            <h2
              className="flex min-w-0 items-center gap-2 font-serif text-sm font-bold italic text-primary"
              id="ask-title"
            >
              <Mail className="size-4 shrink-0" aria-hidden="true" />
              <span className="truncate">
                {ask.anonymousAllowed
                  ? "Ask me anything anonymously"
                  : "Ask me anything"}
              </span>
            </h2>
            <span className="shrink-0 font-mono text-[0.68rem] font-semibold uppercase text-muted-foreground">
              {ask.anonymousAllowed ? "Anonymous" : "Attributed"}
            </span>
          </div>
          <input name="timingToken" type="hidden" value={timingToken} />
          <div aria-hidden="true" className="hidden">
            <label htmlFor="public-ask-website">Website</label>
            <input
              autoComplete="off"
              id="public-ask-website"
              name="website"
              tabIndex={-1}
              type="text"
            />
          </div>

          <div className="border-b border-dashed px-5 pb-2 pt-5">
            <p className="mb-1 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-primary">
              Question ceremony
            </p>
            <p className="font-serif text-lg font-bold leading-tight text-foreground">
              Pick a prompt or write your own.
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {ask.description}
            </p>
            <PromptSuggestionGrid
              className="mt-4 pb-3"
              onSelect={applyPromptSuggestion}
            />
          </div>

          <Field className="gap-0">
            <FieldLabel className="sr-only" htmlFor="public-question">
              Question
            </FieldLabel>
            <Textarea
              aria-describedby="public-question-description public-question-error"
              aria-invalid={error?.fieldErrors?.question === undefined ? undefined : true}
              className="min-h-32 resize-y rounded-none border-0 bg-transparent px-5 py-5 text-[0.96rem] leading-7 placeholder:italic focus-visible:border-transparent focus-visible:ring-0"
              defaultValue={error?.values.question}
              id="public-question"
              maxLength={500}
              name="question"
              placeholder={`Ask ${profile.displayName} anything...`}
              ref={questionRef}
              required
              rows={4}
            />
            {error?.fieldErrors?.question === undefined ? null : (
              <p className="px-5 pb-4 text-sm leading-6 text-destructive" id="public-question-error">
                {error.fieldErrors.question}
              </p>
            )}
            <FieldDescription className="sr-only" id="public-question-description">
              500 characters max. Incoming questions stay private unless answered.
            </FieldDescription>
          </Field>

          <IdentityControls ask={ask} error={error} />

          <div className="flex flex-col gap-3 border-t bg-secondary px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-medium leading-5 text-muted-foreground">
              500 characters max. Incoming questions stay private unless answered.
            </p>
            <PendingButton className="w-full px-6 sm:w-fit" pendingText="Sending">
              <Send data-icon="inline-start" />
              Send question
            </PendingButton>
          </div>
        </FieldGroup>
      </Form>
    </section>
  );
}

function getAskToastMessage(flash: PublicAskFlash | undefined) {
  if (flash?.status === "success") {
    return flash.message;
  }

  return flash?.formError;
}

export function AskComposerPreview({
  ask,
  profile,
}: {
  ask: PublicAskStateAllowed;
  profile: PublicProfileView;
}) {
  return (
    <section
      aria-label="Public ask preview"
      className="overflow-hidden rounded-3xl border bg-card text-card-foreground shadow-[var(--shadow-card)]"
      id="ask-preview"
    >
      <FieldGroup className="gap-0">
        <div className="flex items-center justify-between gap-3 border-b bg-secondary px-5 py-3.5">
          <h2 className="flex min-w-0 items-center gap-2 font-serif text-sm font-bold italic text-primary">
            <Mail className="size-4 shrink-0" aria-hidden="true" />
            <span className="truncate">Send {profile.displayName} a question</span>
          </h2>
          <span className="shrink-0 font-mono text-[0.68rem] font-semibold uppercase text-muted-foreground">
            Public preview
          </span>
        </div>

        <div className="border-b border-dashed px-5 pb-2 pt-5">
          <p className="mb-1 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-primary">
            Question ceremony
          </p>
          <p className="font-serif text-lg font-bold leading-tight text-foreground">
            Pick a prompt or write your own.
          </p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {ask.description}
          </p>
          <PromptSuggestionGrid className="mt-4 pb-3" readOnly />
        </div>

        <Textarea
          aria-label="Question preview"
          className="min-h-32 resize-none rounded-none border-0 bg-transparent px-5 py-5 text-[0.96rem] leading-7 placeholder:italic focus-visible:border-transparent focus-visible:ring-0"
          placeholder={`Ask ${profile.displayName} something specific...`}
          readOnly
          rows={4}
          tabIndex={-1}
        />

        <div className="flex flex-col gap-3 border-t bg-secondary px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-xs font-medium leading-5 text-muted-foreground">
            <span
              aria-hidden="true"
              className="inline-flex size-5 rounded-full bg-primary shadow-[inset_0_0_0_2px_var(--primary)]"
            />
            {ask.anonymousAllowed ? "Send anonymously" : "Send with your profile"}
          </div>
          <Button className="w-full px-6 disabled:opacity-100 sm:w-fit" disabled>
            <Send data-icon="inline-start" />
            Send question
          </Button>
        </div>
      </FieldGroup>
    </section>
  );
}

function PromptSuggestionGrid({
  className,
  onSelect,
  readOnly = false,
}: {
  className?: string | undefined;
  onSelect?: ((prompt: string) => void) | undefined;
  readOnly?: boolean | undefined;
}) {
  return (
    <div
      className={cn(
        "no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-4 pt-2",
        className,
      )}
    >
      {publicPromptSuggestions.map((prompt, index) => (
        <Button
          aria-label={`Use prompt: ${prompt}`}
          className={cn(
            "h-auto min-h-24 w-40 shrink-0 justify-start whitespace-normal rounded-[12px] border-border bg-card px-3.5 py-3.5 text-left text-[0.82rem] font-medium leading-[1.4] text-muted-foreground shadow-[0_2px_8px_rgb(0_0_0/0.02)] transition-[border-color,box-shadow,color,transform] duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1 hover:rotate-0 hover:scale-[1.03] hover:border-primary hover:bg-card hover:text-primary hover:shadow-[0_8px_20px_var(--accent-glow)] disabled:opacity-100 motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:hover:scale-100",
            promptSuggestionTilt[index % promptSuggestionTilt.length],
          )}
          disabled={readOnly}
          key={prompt}
          onClick={() => {
            onSelect?.(prompt);
          }}
          type="button"
          variant="outline"
        >
          {prompt}
        </Button>
      ))}
    </div>
  );
}

function IdentityControls({
  ask,
  error,
}: {
  ask: PublicAskStateAllowed;
  error: Extract<PublicAskFlash, { status: "error" }> | undefined;
}) {
  if (!ask.anonymousAllowed || !ask.attributedAllowed) {
    return (
      <input
        name="identityMode"
        type="hidden"
        value={ask.anonymousAllowed ? "anonymous" : "attributed"}
      />
    );
  }

  return (
    <fieldset className="flex flex-col gap-2 border-t bg-secondary px-5 py-3">
      <legend className="sr-only">Ask as</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        <IdentityOption
          defaultChecked={(error?.values.identityMode ?? ask.defaultIdentity) === "anonymous"}
          description="Anonymous to the recipient and public viewers."
          label="Anonymous"
          value="anonymous"
        />
        <IdentityOption
          defaultChecked={(error?.values.identityMode ?? ask.defaultIdentity) === "attributed"}
          description="Your profile is attached if the question is answered."
          label="Your profile"
          value="attributed"
        />
      </div>
      {error?.fieldErrors?.identityMode === undefined ? null : (
        <p className="text-sm leading-6 text-destructive">
          {error.fieldErrors.identityMode}
        </p>
      )}
    </fieldset>
  );
}

function IdentityOption({
  defaultChecked,
  description,
  label,
  value,
}: {
  defaultChecked: boolean;
  description: string;
  label: string;
  value: "anonymous" | "attributed";
}) {
  return (
    <label className="flex gap-3 rounded-xl border bg-card p-3 text-sm transition-colors hover:border-primary/40">
      <input
        className="mt-1 size-4 accent-primary"
        defaultChecked={defaultChecked}
        name="identityMode"
        type="radio"
        value={value}
      />
      <span className="flex flex-col gap-1">
        <span className="font-medium">{label}</span>
        <span className="leading-5 text-muted-foreground">{description}</span>
      </span>
    </label>
  );
}
