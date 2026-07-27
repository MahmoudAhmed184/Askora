import { PencilLine } from "lucide-react";

export function EditedQuestionBadge() {
  return (
    <span
      className="inline-flex w-fit shrink-0 items-center gap-1 self-start rounded-full border bg-secondary px-2.5 py-1 font-mono text-[0.68rem] font-semibold text-muted-foreground"
      data-slot="edited-question-badge"
      title="The profile owner edited the wording of this question."
    >
      <PencilLine aria-hidden="true" className="size-3" />
      Edited question
    </span>
  );
}
