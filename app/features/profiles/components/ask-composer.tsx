import { Send } from "lucide-react";
import { Form } from "react-router";

import { PendingButton } from "~/components/app/pending-button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "~/components/ui/field";
import { Textarea } from "~/components/ui/textarea";
import type { PublicAskStateAllowed } from "~/features/profiles/ask-permissions.server";
import type { PublicAskFlash } from "~/features/profiles/ask-friction.server";
import type { PublicProfileView } from "~/features/profiles/profile.loader.server";

interface AskComposerProps {
  ask: PublicAskStateAllowed;
  flash: PublicAskFlash | undefined;
  profile: PublicProfileView;
  timingToken: string;
}

export function AskComposer({
  ask,
  flash,
  profile,
  timingToken,
}: AskComposerProps) {
  const error = flash?.status === "error" ? flash : undefined;

  return (
    <section
      aria-labelledby="ask-title"
      className="rounded-lg border bg-card p-5 text-card-foreground"
      id="ask"
    >
      <Form action={`/${profile.username}/questions`} method="post" replace>
        <FieldGroup>
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-semibold" id="ask-title">
              {ask.anonymousAllowed
                ? "Ask me anything anonymously"
                : "Ask me anything"}
            </h2>
            <p className="text-sm leading-6 text-muted-foreground">
              {ask.description}
            </p>
          </div>

          <FlashMessage flash={flash} />

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

          <Field>
            <FieldLabel htmlFor="public-question">Question</FieldLabel>
            <Textarea
              aria-describedby="public-question-description public-question-error"
              aria-invalid={error?.fieldErrors?.question === undefined ? undefined : true}
              defaultValue={error?.values.question}
              id="public-question"
              maxLength={500}
              name="question"
              placeholder={`Ask ${profile.displayName} anything...`}
              required
              rows={5}
            />
            <FieldDescription id="public-question-description">
              500 characters max. Incoming questions stay private unless answered.
            </FieldDescription>
            {error?.fieldErrors?.question === undefined ? null : (
              <p className="text-sm leading-6 text-destructive" id="public-question-error">
                {error.fieldErrors.question}
              </p>
            )}
          </Field>

          <IdentityControls ask={ask} error={error} />

          {error?.formError === undefined ? null : (
            <p className="text-sm leading-6 text-destructive" role="alert">
              {error.formError}
            </p>
          )}

          <PendingButton className="w-full sm:w-fit" pendingText="Sending">
            <Send data-icon="inline-start" />
            Send question
          </PendingButton>
        </FieldGroup>
      </Form>
    </section>
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
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium">Ask as</legend>
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
    <label className="flex gap-3 rounded-lg border bg-background p-3 text-sm">
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

function FlashMessage({ flash }: { flash: PublicAskFlash | undefined }) {
  if (flash?.status !== "success") {
    return null;
  }

  return (
    <div className="rounded-lg border bg-background p-3" role="status">
      <p className="text-sm font-medium">{flash.message}</p>
      {flash.prompt === undefined ? null : (
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {flash.prompt}
        </p>
      )}
    </div>
  );
}
