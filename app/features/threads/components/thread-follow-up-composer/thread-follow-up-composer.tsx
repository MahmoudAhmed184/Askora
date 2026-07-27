import { Send } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { useFetcher } from "react-router";

import { ActionToast } from "~/components/shared/action-toast/action-toast";
import { PendingButton } from "~/components/shared/pending-button/pending-button";
import { Textarea } from "~/components/ui/textarea/textarea";
import { FollowUpIdentityControls } from "~/features/threads/components/follow-up-composer";
import {
  INLINE_FOLLOW_UP_FIELD,
  INLINE_FOLLOW_UP_VALUE,
  type InlineFollowUpActionData,
} from "~/features/threads/inline-follow-up";
import type {
  FollowUpFlash,
  PublicThreadFollowUpState,
} from "~/features/threads/types/threads.types";

interface ThreadFollowUpComposerProps {
  followUp: Extract<PublicThreadFollowUpState, { status: "allowed" }>;
  profile: {
    displayName: string;
    username: string;
  };
  threadPublicId: string;
  timingToken: string;
}

export function ThreadFollowUpComposer({
  followUp,
  profile,
  threadPublicId,
  timingToken,
}: ThreadFollowUpComposerProps) {
  const fetcher = useFetcher<InlineFollowUpActionData>();
  const formRef = useRef<HTMLFormElement>(null);
  const questionId = useId();
  const descriptionId = useId();
  const errorId = useId();
  const websiteId = useId();
  const flash = fetcher.data?.followUp;
  const error = flash?.status === "error" ? flash : undefined;
  const isSubmitting = fetcher.state !== "idle";

  useEffect(() => {
    if (flash?.status === "success") {
      formRef.current?.reset();
    }
  }, [flash]);

  return (
    <section aria-labelledby={`${questionId}-title`} id="follow-up">
      <ActionToast
        description={flash?.status === "success" ? flash.prompt : undefined}
        message={getInlineFollowUpToastMessage(flash)}
        tone={flash?.status === "success" ? "success" : "error"}
        trigger={flash}
      />
      <fetcher.Form
        action={`/${profile.username}/a/${threadPublicId}/follow-ups`}
        aria-label="Ask a follow-up"
        className="flex flex-col gap-3"
        method="post"
        ref={formRef}
      >
        <input
          name={INLINE_FOLLOW_UP_FIELD}
          type="hidden"
          value={INLINE_FOLLOW_UP_VALUE}
        />
        <input
          name="timingToken"
          type="hidden"
          value={fetcher.data?.timingToken ?? timingToken}
        />
        <div aria-hidden="true" className="hidden">
          <label htmlFor={websiteId}>Website</label>
          <input
            autoComplete="off"
            id={websiteId}
            name="website"
            tabIndex={-1}
            type="text"
          />
        </div>

        <h2
          className="text-sm font-bold text-foreground"
          id={`${questionId}-title`}
        >
          Ask a follow-up
        </h2>

        <label className="sr-only" htmlFor={questionId}>
          Follow-up
        </label>
        <Textarea
          aria-describedby={
            error?.fieldErrors?.question === undefined
              ? descriptionId
              : `${descriptionId} ${errorId}`
          }
          aria-invalid={
            error?.fieldErrors?.question === undefined ? undefined : true
          }
          className="min-h-20 resize-y"
          defaultValue={error?.values.question}
          disabled={isSubmitting}
          id={questionId}
          maxLength={500}
          name="question"
          placeholder={`Ask ${profile.displayName} a follow-up...`}
          required
          rows={3}
        />
        {error?.fieldErrors?.question === undefined ? null : (
          <p
            className="text-sm leading-6 text-destructive"
            id={errorId}
            role="alert"
          >
            {error.fieldErrors.question}
          </p>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <FollowUpIdentityControls
              error={error}
              followUp={followUp}
              variant="inline"
            />
            <p
              className="text-xs leading-5 text-muted-foreground"
              id={descriptionId}
            >
              500 characters max. Follow-ups stay private unless answered.
            </p>
          </div>
          <PendingButton
            className="w-full sm:w-fit"
            disabled={isSubmitting}
            pending={isSubmitting}
            pendingText="Sending"
            size="sm"
            type="submit"
          >
            <Send data-icon="inline-start" />
            Send follow-up
          </PendingButton>
        </div>
      </fetcher.Form>
    </section>
  );
}

function getInlineFollowUpToastMessage(flash: FollowUpFlash | undefined) {
  if (flash?.status === "success") {
    return flash.message;
  }

  return flash?.formError;
}
