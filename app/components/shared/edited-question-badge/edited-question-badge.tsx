import { PencilLine } from "lucide-react";

import { cn } from "~/lib/utils";

interface EditedQuestionBadgeProps {
  variant?: "badge" | "icon";
}

export function EditedQuestionBadge({
  variant = "badge",
}: EditedQuestionBadgeProps) {
  const isIconOnly = variant === "icon";

  return (
    <span
      aria-label={isIconOnly ? "Edited question" : undefined}
      className={cn(
        "inline-flex shrink-0 items-center text-muted-foreground",
        isIconOnly
          ? "size-10 justify-center"
          : "w-fit gap-1 rounded-full border bg-secondary px-2.5 py-1 font-mono text-[0.68rem] font-semibold",
      )}
      data-slot="edited-question-badge"
      title="The profile owner edited the wording of this question."
    >
      <PencilLine
        aria-hidden="true"
        className={isIconOnly ? "size-4" : "size-3"}
      />
      {isIconOnly ? null : "Edited question"}
    </span>
  );
}
