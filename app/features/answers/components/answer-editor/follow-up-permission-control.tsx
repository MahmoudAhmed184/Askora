import {
  ChevronDown,
  Globe2,
  LogIn,
  MessageCircleOff,
  UserRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Button } from "~/components/ui/button/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu/dropdown-menu";
import { Field, FieldError, FieldLabel } from "~/components/ui/field/field";
import type { AnswerFormValues } from "~/features/answers/types/answers.types";
import type { FollowUpPermission } from "~/features/settings/validations/settings.validations";

interface FollowUpPermissionControlProps {
  defaultPermission: FollowUpPermission;
  error?: string | undefined;
  onChange: (
    permission: AnswerFormValues["followUpPermissionOverride"],
  ) => void;
  value: AnswerFormValues["followUpPermissionOverride"];
}

interface FollowUpPermissionOption {
  description: string;
  icon: LucideIcon;
  label: string;
  shortLabel: string;
  value: FollowUpPermission;
}

const profileDefaultValue = "profile_default";

const followUpPermissionOptions = [
  {
    value: "anyone",
    label: "Anyone in the thread",
    shortLabel: "Anyone",
    description: "Everyone who can view the thread.",
    icon: Globe2,
  },
  {
    value: "logged_in",
    label: "Logged-in users",
    shortLabel: "Logged in",
    description: "Only people signed in to Askora.",
    icon: LogIn,
  },
  {
    value: "original_asker",
    label: "Original asker only",
    shortLabel: "Original asker",
    description: "Only the person who asked this question.",
    icon: UserRound,
  },
  {
    value: "off",
    label: "No follow-ups",
    shortLabel: "Off",
    description: "Close this answer to new follow-ups.",
    icon: MessageCircleOff,
  },
] as const satisfies readonly FollowUpPermissionOption[];

export function FollowUpPermissionControl({
  defaultPermission,
  error,
  onChange,
  value,
}: FollowUpPermissionControlProps) {
  const selectedValue = normalizePermissionChoice(value);
  const selectedPermission =
    selectedValue === profileDefaultValue ? defaultPermission : selectedValue;
  const selectedOption = getFollowUpPermissionOption(selectedPermission);
  const SelectedIcon = selectedOption.icon;
  const accessibleValue =
    selectedValue === profileDefaultValue
      ? `Profile default, ${selectedOption.shortLabel}`
      : selectedOption.label;

  return (
    <Field data-invalid={error === undefined ? undefined : true}>
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-t border-dashed pt-4">
        <div className="min-w-0">
          <FieldLabel id="followUpPermissionOverride-label">
            Follow-ups
          </FieldLabel>
          <p
            className="mt-1 text-xs leading-5 text-muted-foreground"
            id="followUpPermissionOverride-description"
          >
            Who can reply after publishing
          </p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              aria-describedby="followUpPermissionOverride-description followUpPermissionOverride-message"
              aria-invalid={error !== undefined}
              aria-label={`Follow-ups: ${accessibleValue}`}
              className="max-w-full justify-start px-3.5"
              size="lg"
              type="button"
              variant="outline"
            >
              <SelectedIcon aria-hidden="true" data-icon="inline-start" />
              <span className="truncate">
                {selectedValue === profileDefaultValue
                  ? `Default: ${selectedOption.shortLabel}`
                  : selectedOption.shortLabel}
              </span>
              <ChevronDown
                aria-hidden="true"
                className="ml-auto"
                data-icon="inline-end"
              />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-[min(20rem,calc(100vw-2rem))]"
            collisionPadding={16}
          >
            <DropdownMenuLabel>Who can follow up?</DropdownMenuLabel>
            <DropdownMenuGroup>
              <DropdownMenuRadioGroup
                onValueChange={(nextValue) => {
                  onChange(getPermissionOverride(nextValue));
                }}
                value={selectedValue}
              >
                <DropdownMenuRadioItem
                  className="items-start py-2.5"
                  value={profileDefaultValue}
                >
                  <PermissionOptionText
                    description={`Uses your profile setting: ${getFollowUpPermissionOption(defaultPermission).label}.`}
                    label="Use profile default"
                  />
                </DropdownMenuRadioItem>
                {followUpPermissionOptions.map((option) => (
                  <DropdownMenuRadioItem
                    className="items-start py-2.5"
                    key={option.value}
                    value={option.value}
                  >
                    <PermissionOptionText
                      description={option.description}
                      label={option.label}
                    />
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <input
        name="followUpPermissionOverride"
        type="hidden"
        value={selectedValue === profileDefaultValue ? "" : selectedValue}
      />
      <FieldError id="followUpPermissionOverride-message" message={error} />
    </Field>
  );
}

function PermissionOptionText({
  description,
  label,
}: {
  description: string;
  label: string;
}) {
  return (
    <span className="flex min-w-0 flex-col gap-0.5">
      <span className="font-semibold text-foreground">{label}</span>
      <span className="text-xs leading-5 text-muted-foreground">
        {description}
      </span>
    </span>
  );
}

function normalizePermissionChoice(
  value: AnswerFormValues["followUpPermissionOverride"],
) {
  return value === "unknown" || value === null ? profileDefaultValue : value;
}

function getPermissionOverride(
  value: string,
): AnswerFormValues["followUpPermissionOverride"] {
  if (value === profileDefaultValue) {
    return null;
  }

  return (
    followUpPermissionOptions.find((option) => option.value === value)?.value ??
    null
  );
}

function getFollowUpPermissionOption(value: FollowUpPermission) {
  const option = followUpPermissionOptions.find(
    (candidate) => candidate.value === value,
  );

  if (option === undefined) {
    throw new Error(`Unknown follow-up permission: ${value}`);
  }

  return option;
}
