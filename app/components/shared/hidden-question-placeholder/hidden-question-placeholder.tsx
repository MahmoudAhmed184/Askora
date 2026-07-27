import { EyeOff } from "lucide-react";

import { cn } from "~/lib/utils";

export function HiddenQuestionPlaceholder({
  className,
}: {
  className?: string | undefined;
}) {
  return (
    <div
      aria-label="Question hidden by the profile owner"
      className={cn("flex min-w-0 flex-col gap-2.5", className)}
      data-slot="hidden-question-placeholder"
    >
      <span className="inline-flex w-fit items-center gap-1.5 rounded-full border bg-secondary px-2.5 py-1 font-mono text-[0.68rem] font-semibold text-muted-foreground">
        <EyeOff aria-hidden="true" className="size-3.5" />
        Hidden question
      </span>
      <div
        aria-hidden="true"
        className="flex max-w-xl flex-col gap-2 opacity-45 blur-[2px]"
      >
        <span className="h-3.5 w-11/12 rounded-full bg-muted-foreground/55" />
        <span className="h-3.5 w-7/12 rounded-full bg-muted-foreground/40" />
      </div>
    </div>
  );
}
