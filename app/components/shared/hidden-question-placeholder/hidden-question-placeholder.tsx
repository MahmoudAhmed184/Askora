import { Eye, EyeOff } from "lucide-react";

import { Button } from "~/components/ui/button/button";
import { cn } from "~/lib/utils";

export function HiddenQuestionPlaceholder({
  className,
}: {
  className?: string | undefined;
}) {
  return (
    <div
      aria-label="Question hidden by the profile owner"
      className={cn("min-w-0", className)}
      data-slot="hidden-question-placeholder"
    >
      <div
        aria-hidden="true"
        className="flex min-w-0 max-w-xl flex-col gap-2 opacity-45 blur-[2px]"
      >
        <span className="h-3.5 w-11/12 rounded-full bg-muted-foreground/55" />
        <span className="h-3.5 w-7/12 rounded-full bg-muted-foreground/40" />
      </div>
    </div>
  );
}

export function HiddenQuestionIndicator() {
  return <HiddenQuestionBadge label="Hidden question" />;
}

export function OwnerHiddenQuestion({
  className,
  direction,
  isRevealed,
  text,
  textClassName,
}: {
  className?: string | undefined;
  direction: "ltr" | "rtl";
  isRevealed: boolean;
  text: string;
  textClassName?: string | undefined;
}) {
  return (
    <p
      aria-hidden={isRevealed ? undefined : true}
      className={cn(
        "min-w-0 whitespace-pre-wrap break-words transition-[filter,opacity] duration-200 motion-reduce:transition-none",
        !isRevealed && "select-none opacity-55 blur-sm",
        textClassName,
        className,
      )}
      data-slot="owner-hidden-question"
      dir={direction}
    >
      {text}
    </p>
  );
}

export function HiddenQuestionVisibilityButton({
  isRevealed,
  onChange,
}: {
  isRevealed: boolean;
  onChange: (isRevealed: boolean) => void;
}) {
  const label = isRevealed ? "Hide question again" : "Show hidden question";

  return (
    <Button
      aria-label={label}
      aria-pressed={isRevealed}
      className="size-10 p-0 text-muted-foreground"
      onClick={() => {
        onChange(!isRevealed);
      }}
      size="icon"
      title={label}
      type="button"
      variant="ghost"
    >
      {isRevealed ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
    </Button>
  );
}

function HiddenQuestionBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex w-fit items-center gap-1.5 rounded-full border bg-secondary px-2.5 py-1 font-mono text-[0.68rem] font-semibold text-muted-foreground">
      <EyeOff aria-hidden="true" className="size-3.5" />
      {label}
    </span>
  );
}
