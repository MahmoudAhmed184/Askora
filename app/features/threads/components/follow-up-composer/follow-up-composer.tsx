import { Send } from "lucide-react";
import { Form } from "react-router";

import { ActionToast } from "~/components/shared/action-toast/action-toast";
import { PendingButton } from "~/components/shared/pending-button/pending-button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "~/components/ui/field/field";
import { Textarea } from "~/components/ui/textarea/textarea";
import type { PublicThreadFollowUpState } from "~/features/threads/types/threads.types";
import type { FollowUpFlash } from "~/features/threads/types/threads.types";

interface FollowUpComposerProps {
  flash: FollowUpFlash | undefined;
  followUp: Extract<PublicThreadFollowUpState, { status: "allowed" }>;
  profile: {
    displayName: string;
  };
  timingToken: string;
}

export function FollowUpComposer({
  flash,
  followUp,
  profile,
  timingToken,
}: FollowUpComposerProps) {
  const error = flash?.status === "error" ? flash : undefined;

  return (
    <section
      aria-labelledby="follow-up-title"
      className="rounded-3xl border bg-card p-6 text-card-foreground shadow-[var(--shadow-card)]"
      id="follow-up"
    >
      <ActionToast
        description={flash?.status === "success" ? flash.prompt : undefined}
        message={getFollowUpToastMessage(flash)}
        tone={flash?.status === "success" ? "success" : "error"}
        trigger={flash}
      />
      <Form method="post" replace>
        <FieldGroup className="gap-5">
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-semibold" id="follow-up-title">
              Ask a follow-up
            </h2>
            <p className="text-sm leading-6 text-muted-foreground">
              {followUp.description}
            </p>
          </div>
          <input name="timingToken" type="hidden" value={timingToken} />
          <div aria-hidden="true" className="hidden">
            <label htmlFor="follow-up-website">Website</label>
            <input
              autoComplete="off"
              id="follow-up-website"
              name="website"
              tabIndex={-1}
              type="text"
            />
          </div>

          <Field>
            <FieldLabel htmlFor="follow-up-question">Follow-up</FieldLabel>
            <Textarea
              aria-describedby="follow-up-question-description follow-up-question-error"
              aria-invalid={
                error?.fieldErrors?.question === undefined ? undefined : true
              }
              defaultValue={error?.values.question}
              id="follow-up-question"
              maxLength={500}
              name="question"
              placeholder={`Ask ${profile.displayName} a follow-up...`}
              required
              rows={5}
            />
            <FieldDescription id="follow-up-question-description">
              500 characters max. Follow-ups stay private unless answered.
            </FieldDescription>
            {error?.fieldErrors?.question === undefined ? null : (
              <p
                className="text-sm leading-6 text-destructive"
                id="follow-up-question-error"
              >
                {error.fieldErrors.question}
              </p>
            )}
          </Field>

          <IdentityControls error={error} followUp={followUp} />

          <PendingButton className="w-full sm:w-fit" pendingText="Sending">
            <Send data-icon="inline-start" />
            Send follow-up
          </PendingButton>
        </FieldGroup>
      </Form>
    </section>
  );
}

function getFollowUpToastMessage(flash: FollowUpFlash | undefined) {
  if (flash?.status === "success") {
    return flash.message;
  }

  return flash?.formError;
}

function IdentityControls({
  error,
  followUp,
}: {
  error: Extract<FollowUpFlash, { status: "error" }> | undefined;
  followUp: Extract<PublicThreadFollowUpState, { status: "allowed" }>;
}) {
  if (!followUp.anonymousAllowed || !followUp.attributedAllowed) {
    return (
      <input
        name="identityMode"
        type="hidden"
        value={followUp.anonymousAllowed ? "anonymous" : "attributed"}
      />
    );
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium">Send as</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        <IdentityOption
          defaultChecked={
            (error?.values.identityMode ?? followUp.defaultIdentity) ===
            "anonymous"
          }
          description="Anonymous to the recipient and public viewers."
          label="Anonymous"
          value="anonymous"
        />
        <IdentityOption
          defaultChecked={
            (error?.values.identityMode ?? followUp.defaultIdentity) ===
            "attributed"
          }
          description="Your profile is attached if the follow-up is answered."
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
    <label className="flex gap-3 rounded-xl border bg-secondary p-3 text-sm">
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
