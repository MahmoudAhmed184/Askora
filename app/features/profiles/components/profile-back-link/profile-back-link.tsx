import { ArrowLeft } from "lucide-react";
import { Link, useNavigate } from "react-router";

import { Button } from "~/components/ui/button/button";

interface ProfileBackLinkProps {
  fallbackHref: string;
}

export function ProfileBackLink({ fallbackHref }: ProfileBackLinkProps) {
  const navigate = useNavigate();

  return (
    <Button asChild size="sm" variant="ghost">
      <Link
        onClick={(event) => {
          if (
            event.defaultPrevented ||
            isModifiedClick(event) ||
            !hasInAppHistory()
          ) {
            return;
          }

          event.preventDefault();
          void navigate(-1);
        }}
        to={fallbackHref}
      >
        <ArrowLeft data-icon="inline-start" />
        Back
      </Link>
    </Button>
  );
}

function hasInAppHistory() {
  const state: unknown = window.history.state;

  return (
    typeof state === "object" &&
    state !== null &&
    "idx" in state &&
    typeof state.idx === "number" &&
    state.idx > 0
  );
}

function isModifiedClick(event: React.MouseEvent) {
  return (
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    event.button !== 0
  );
}
