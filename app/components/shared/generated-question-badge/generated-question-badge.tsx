import { Sparkles } from "lucide-react";

import { Badge } from "~/components/ui/badge/badge";
import { cn } from "~/lib/utils";

export function GeneratedQuestionBadge({
  className,
}: {
  className?: string | undefined;
}) {
  return (
    <Badge
      aria-label="Generated question"
      className={cn(
        "w-fit shrink-0 self-start gap-1.5 border-primary/20 bg-primary/[0.06] px-2 py-1 font-mono text-[0.65rem] font-semibold tracking-[0.04em] text-primary/80",
        className,
      )}
      variant="outline"
    >
      <Sparkles aria-hidden="true" className="size-3.5" data-icon="inline-start" />
      Generated
    </Badge>
  );
}
