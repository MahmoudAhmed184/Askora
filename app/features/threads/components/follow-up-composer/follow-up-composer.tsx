import { Send } from "lucide-react";
import { Form } from "react-router";

import { ActionToast } from "~/components/shared/action-toast/action-toast";
import { IdentitySwitch } from "~/components/shared/identity-switch/identity-switch";
import { PendingButton } from "~/components/shared/pending-button/pending-button";
import {
  Field,
  FieldDescription,
  FieldError,
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
            <FieldError
              id="follow-up-question-error"
              message={error?.fieldErrors?.question}
            />
          </Field>

          <FollowUpIdentityControls error={error} followUp={followUp} />

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

export function FollowUpIdentityControls({
  error,
  followUp,
  variant,
}: {
  error: Extract<FollowUpFlash, { status: "error" }> | undefined;
  followUp: Extract<PublicThreadFollowUpState, { status: "allowed" }>;
  variant?: "card" | "inline" | undefined;
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
    <IdentitySwitch
      defaultIdentity={error?.values.identityMode ?? followUp.defaultIdentity}
      error={error?.fieldErrors?.identityMode}
      variant={variant}
    />
  );
}
