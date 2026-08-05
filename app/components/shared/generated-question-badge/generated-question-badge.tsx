import { Sparkles } from "lucide-react";

import { Badge } from "~/components/ui/badge/badge";

export function GeneratedQuestionBadge({
  className,
}: {
  className?: string | undefined;
}) {
  return (
    <Badge
      aria-label="Generated question"
      className={className}
      variant="secondary"
    >
      <Sparkles aria-hidden="true" className="size-3" data-icon="inline-start" />
      Generated
    </Badge>
  );
}
