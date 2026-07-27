import {
  AlertTriangle,
  Ban,
  MessageCircleOff,
  Save,
  Shield,
  Trash2,
  Undo2,
} from "lucide-react";
import { useState } from "react";
import { Form } from "react-router";

import { ActionToast } from "~/components/shared/action-toast/action-toast";
import { PendingButton } from "~/components/shared/pending-button/pending-button";
import { Badge } from "~/components/ui/badge/badge";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "~/components/ui/field/field";
import { Input } from "~/components/ui/input/input";
import { SettingsSwitchField } from "~/features/settings/components/settings-switch-field";
import type {
  SafetyBlockView,
  SafetySettingsFieldErrors,
  SafetySettingsSubmissionResult,
  SafetySettingsViewData,
} from "~/features/settings/types/settings.types";
import { formatMediumDateTime } from "~/lib/date-format";

type SafetySettingsSuccessResult = Extract<
  SafetySettingsSubmissionResult,
  {
    status:
      | "safety_updated"
      | "muted_phrase_added"
      | "muted_phrase_removed"
      | "sender_unblocked";
  }
>;

interface SafetySettingsFormProps {
  settings: SafetySettingsViewData;
  disabled: boolean;
  result: SafetySettingsSubmissionResult | undefined;
}

export function SafetySettingsForm({
  disabled,
  result,
  settings,
}: SafetySettingsFormProps) {
  const [acceptingQuestions, setAcceptingQuestions] = useState(
    result?.status === "safety_updated"
      ? result.values.acceptingQuestions
      : settings.acceptingQuestions,
  );
  const fieldErrors = getFieldErrors(result);

  return (
    <div className="flex flex-col gap-6 p-5 sm:p-6">
      <ActionToast
        message={getSafetySettingsToastMessage(result)}
        tone={
          result !== undefined && isSuccessResult(result) ? "success" : "error"
        }
        trigger={result}
      />
      {disabled ? <LockedNotice /> : undefined}

      <Form
        aria-label="Question safety"
        className="text-card-foreground"
        method="post"
      >
        <input name="intent" type="hidden" value="update_safety" />
        <FieldGroup className="gap-5">
          <fieldset className="contents" disabled={disabled}>
            <section
              aria-labelledby="intake-heading"
              className="flex flex-col gap-4"
            >
              <div className="flex items-start gap-3">
                <Shield
                  aria-hidden="true"
                  className="mt-1 size-4 shrink-0 text-muted-foreground"
                />
                <div>
                  <h2 className="text-base font-semibold" id="intake-heading">
                    Intake gate
                  </h2>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Pause new questions without changing existing inbox items.
                  </p>
                </div>
              </div>

              <SettingsSwitchField
                checked={acceptingQuestions}
                description="When off, visitors see the normal unavailable state for asks."
                disabled={disabled}
                label="Accept new questions"
                name="acceptingQuestions"
                onChange={setAcceptingQuestions}
              />
            </section>
          </fieldset>

          <PendingButton
            className="self-start"
            disabled={disabled}
            pendingName="intent"
            pendingText="Saving safety"
            pendingValue="update_safety"
            type="submit"
          >
            <Save data-icon="inline-start" />
            Save safety
          </PendingButton>
        </FieldGroup>
      </Form>

      <section
        aria-labelledby="muted-phrases-heading"
        className="flex flex-col gap-4"
      >
        <div className="flex items-start gap-3">
          <MessageCircleOff
            aria-hidden="true"
            className="mt-1 size-4 shrink-0 text-muted-foreground"
          />
          <div>
            <h2 className="text-base font-semibold" id="muted-phrases-heading">
              Muted phrases
            </h2>
            <p className="text-sm leading-6 text-muted-foreground">
              Matching private questions go to filtered instead of the inbox.
            </p>
          </div>
        </div>

        <Form
          aria-label="Add muted phrase"
          className="flex flex-col gap-3"
          method="post"
        >
          <input name="intent" type="hidden" value="add_muted_phrase" />
          <fieldset className="contents" disabled={disabled}>
            <Field
              data-invalid={fieldErrors.phrase !== undefined ? true : undefined}
            >
              <FieldLabel htmlFor="mutedPhrase">Phrase</FieldLabel>
              <Input
                aria-describedby="mutedPhrase-description mutedPhrase-message"
                aria-invalid={fieldErrors.phrase !== undefined}
                id="mutedPhrase"
                maxLength={100}
                name="phrase"
                placeholder="Phrase to filter"
              />
              <FieldDescription id="mutedPhrase-description">
                100 characters max. Unicode variants and spacing are normalized.
              </FieldDescription>
              <FieldError
                id="mutedPhrase-message"
                message={fieldErrors.phrase}
              />
            </Field>
          </fieldset>
          <PendingButton
            className="self-start"
            disabled={disabled}
            pendingName="intent"
            pendingText="Adding phrase"
            pendingValue="add_muted_phrase"
            type="submit"
            variant="outline"
          >
            Add muted phrase
          </PendingButton>
        </Form>

        <MutedPhraseList disabled={disabled} settings={settings} />
      </section>

      <section
        aria-labelledby="blocked-senders-heading"
        className="flex flex-col gap-4 border-t pt-6"
      >
        <div className="flex items-start gap-3">
          <Ban
            aria-hidden="true"
            className="mt-1 size-4 shrink-0 text-muted-foreground"
          />
          <div>
            <h2
              className="text-base font-semibold"
              id="blocked-senders-heading"
            >
              Blocked senders
            </h2>
            <p className="text-sm leading-6 text-muted-foreground">
              Unblock account and anonymous-signal blocks created from private
              questions.
            </p>
          </div>
        </div>

        <BlockList blocks={settings.blocks} disabled={disabled} />
      </section>
    </div>
  );
}

function getSafetySettingsToastMessage(
  result: SafetySettingsSubmissionResult | undefined,
) {
  if (result !== undefined && isSuccessResult(result)) {
    return getSuccessMessage(result.status);
  }

  return getFormError(result);
}

function MutedPhraseList({
  disabled,
  settings,
}: {
  disabled: boolean;
  settings: SafetySettingsViewData;
}) {
  if (settings.mutedPhrases.length === 0) {
    return (
      <p className="rounded-xl border bg-secondary p-3 text-sm leading-6 text-muted-foreground">
        No muted phrases.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {settings.mutedPhrases.map((phrase) => (
        <li
          className="flex flex-col gap-3 rounded-xl border bg-secondary p-3 sm:flex-row sm:items-center sm:justify-between"
          key={phrase.id}
        >
          <div className="min-w-0">
            <p className="break-words text-sm font-medium">{phrase.phrase}</p>
            <p className="text-xs leading-5 text-muted-foreground">
              Added{" "}
              <time dateTime={phrase.createdAt}>
                {formatDate(phrase.createdAt)}
              </time>
            </p>
          </div>
          <Form method="post">
            <input name="intent" type="hidden" value="remove_muted_phrase" />
            <input name="mutedPhraseId" type="hidden" value={phrase.id} />
            <PendingButton
              disabled={disabled}
              pendingName="mutedPhraseId"
              pendingText="Removing"
              pendingValue={phrase.id}
              size="sm"
              type="submit"
              variant="outline"
            >
              <Trash2 data-icon="inline-start" />
              Remove
            </PendingButton>
          </Form>
        </li>
      ))}
    </ul>
  );
}

function BlockList({
  blocks,
  disabled,
}: {
  blocks: SafetyBlockView[];
  disabled: boolean;
}) {
  if (blocks.length === 0) {
    return (
      <p className="rounded-xl border bg-secondary p-3 text-sm leading-6 text-muted-foreground">
        No blocked senders.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {blocks.map((block) => (
        <li
          className="flex flex-col gap-3 rounded-xl border bg-secondary p-3 sm:flex-row sm:items-center sm:justify-between"
          key={block.id}
        >
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="break-words text-sm font-medium">
                {getBlockLabel(block)}
              </p>
              <Badge variant="outline">{getBlockTypeLabel(block.type)}</Badge>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
              Blocked{" "}
              <time dateTime={block.createdAt}>
                {formatDate(block.createdAt)}
              </time>
            </p>
          </div>
          <Form method="post">
            <input name="intent" type="hidden" value="unblock_sender" />
            <input name="blockId" type="hidden" value={block.id} />
            <PendingButton
              disabled={disabled}
              pendingName="blockId"
              pendingText="Unblocking"
              pendingValue={block.id}
              size="sm"
              type="submit"
              variant="outline"
            >
              <Undo2 data-icon="inline-start" />
              Unblock
            </PendingButton>
          </Form>
        </li>
      ))}
    </ul>
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

function LockedNotice() {
  return (
    <div className="flex items-start gap-3 rounded-2xl border bg-secondary/70 px-4 py-3 text-sm leading-6 text-muted-foreground">
      <AlertTriangle
        aria-hidden="true"
        className="mt-0.5 size-4 shrink-0 text-destructive"
      />
      Safety settings are locked while this account is suspended.
    </div>
  );
}

function getFieldErrors(
  result: SafetySettingsSubmissionResult | undefined,
): SafetySettingsFieldErrors {
  if (
    result?.status === "invalid" ||
    result?.status === "muted_phrase_duplicate" ||
    result?.status === "muted_phrase_limit"
  ) {
    return result.fieldErrors;
  }

  return {};
}

function getFormError(result: SafetySettingsSubmissionResult | undefined) {
  if (
    result?.status === "invalid" ||
    result?.status === "suspended" ||
    result?.status === "not_found" ||
    result?.status === "muted_phrase_duplicate" ||
    result?.status === "muted_phrase_limit"
  ) {
    return result.formError;
  }

  return undefined;
}

function isSuccessResult(
  result: SafetySettingsSubmissionResult,
): result is SafetySettingsSuccessResult {
  return (
    result.status === "safety_updated" ||
    result.status === "muted_phrase_added" ||
    result.status === "muted_phrase_removed" ||
    result.status === "sender_unblocked"
  );
}

function getSuccessMessage(
  status: Extract<
    SafetySettingsSubmissionResult["status"],
    | "safety_updated"
    | "muted_phrase_added"
    | "muted_phrase_removed"
    | "sender_unblocked"
  >,
) {
  switch (status) {
    case "safety_updated":
      return "Safety settings saved.";
    case "muted_phrase_added":
      return "Muted phrase added.";
    case "muted_phrase_removed":
      return "Muted phrase removed.";
    case "sender_unblocked":
      return "Sender unblocked.";
  }
}

function getBlockLabel(block: SafetyBlockView) {
  if (block.type === "account") {
    if (block.profile === undefined) {
      return "Account sender";
    }

    return `${block.profile.displayName} (@${block.profile.username})`;
  }

  if (block.type === "account_anonymous") {
    return "Anonymous account sender";
  }

  return "Anonymous sender";
}

function getBlockTypeLabel(type: SafetyBlockView["type"]) {
  if (type === "account") {
    return "Account";
  }

  if (type === "account_anonymous") {
    return "Anonymous account";
  }

  return "Anonymous signal";
}

function formatDate(value: string) {
  return formatMediumDateTime(value);
}
