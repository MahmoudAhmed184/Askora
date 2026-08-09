import { ChevronDown, Eye, EyeOff, PencilLine } from "lucide-react";
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
import type { QuestionTextMode } from "~/features/answers/validations/answer.validations";

interface QuestionWordingControlProps {
  error?: string | undefined;
  onChange: (mode: QuestionTextMode) => void;
  value: AnswerFormValues["questionTextMode"];
}

interface QuestionWordingOption {
  description: string;
  icon: LucideIcon;
  label: string;
  value: QuestionTextMode;
}

const questionWordingOptions = [
  {
    value: "original",
    label: "Original",
    description: "Show the question exactly as received.",
    icon: Eye,
  },
  {
    value: "hidden",
    label: "Hidden",
    description: "Publish the answer without public question text.",
    icon: EyeOff,
  },
] as const satisfies readonly QuestionWordingOption[];

const customQuestionWording = {
  value: "edited",
  label: "Custom wording",
  description: "Show your rewritten version of the question.",
  icon: PencilLine,
} as const satisfies QuestionWordingOption;

export function QuestionWordingControl({
  error,
  onChange,
  value,
}: QuestionWordingControlProps) {
  const selectedOption =
    value === customQuestionWording.value
      ? customQuestionWording
      : questionWordingOptions.find((option) => option.value === value);
  const SelectedIcon = selectedOption?.icon ?? Eye;
  const selectedLabel = selectedOption?.label ?? "Choose wording";

  return (
    <Field data-invalid={error === undefined ? undefined : true}>
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <FieldLabel id="questionTextMode-label">
            Public question wording
          </FieldLabel>
          <p
            className="mt-1 text-xs leading-5 text-muted-foreground"
            id="questionTextMode-description"
          >
            What readers see above your answer
          </p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              aria-describedby="questionTextMode-description questionTextMode-message"
              aria-invalid={error !== undefined}
              aria-label={`Public question wording: ${selectedLabel}`}
              className="max-w-full justify-start px-3.5"
              size="lg"
              type="button"
              variant="outline"
            >
              <SelectedIcon aria-hidden="true" data-icon="inline-start" />
              <span className="truncate">{selectedLabel}</span>
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
            <DropdownMenuLabel>
              Show the original question or hide it
            </DropdownMenuLabel>
            <DropdownMenuGroup>
              <DropdownMenuRadioGroup
                onValueChange={(nextValue) => {
                  const nextOption = questionWordingOptions.find(
                    (option) => option.value === nextValue,
                  );

                  if (nextOption !== undefined) {
                    onChange(nextOption.value);
                  }
                }}
                value={value}
              >
                {questionWordingOptions.map((option) => (
                  <DropdownMenuRadioItem
                    className="items-start py-2.5"
                    key={option.value}
                    value={option.value}
                  >
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="font-semibold text-foreground">
                        {option.label}
                      </span>
                      <span className="text-xs leading-5 text-muted-foreground">
                        {option.description}
                      </span>
                    </span>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <input name="questionTextMode" type="hidden" value={value} />
      <FieldError id="questionTextMode-message" message={error} />
    </Field>
  );
}
