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
import type { PublicThreadFollowUpState } from "~/features/threads/thread-permissions.server";
import type { FollowUpFlash } from "~/features/threads/follow-up.server";

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
      className="rounded-lg border bg-card p-5 text-card-foreground"
      id="follow-up"
    >
      <Form method="post" replace>
        <FieldGroup>
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-semibold" id="follow-up-title">
              Ask a follow-up
            </h2>
            <p className="text-sm leading-6 text-muted-foreground">
              {followUp.description}
            </p>
          </div>

          <FlashMessage flash={flash} />

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

          {error?.formError === undefined ? null : (
            <p className="text-sm leading-6 text-destructive" role="alert">
              {error.formError}
            </p>
          )}

          <PendingButton className="w-full sm:w-fit" pendingText="Sending">
            <Send data-icon="inline-start" />
            Send follow-up
          </PendingButton>
        </FieldGroup>
      </Form>
    </section>
  );
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

function FlashMessage({ flash }: { flash: FollowUpFlash | undefined }) {
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
