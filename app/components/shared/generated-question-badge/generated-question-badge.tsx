import { Sparkles } from "lucide-react";

import { Badge } from "~/components/ui/badge/badge";

export function GeneratedQuestionBadge() {
  return (
    <Badge aria-label="Generated question" variant="secondary">
      <Sparkles aria-hidden="true" className="size-3" data-icon="inline-start" />
      Generated
    </Badge>
  );
}
