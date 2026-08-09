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
      aria-label="AI-generated question"
      className={cn(
        "size-7 shrink-0 self-start justify-center rounded-full border-primary/20 bg-primary/[0.06] p-0 text-primary/80",
        className,
      )}
      title="AI-generated question"
      variant="outline"
    >
      <Sparkles aria-hidden="true" className="size-3.5" />
    </Badge>
  );
}
