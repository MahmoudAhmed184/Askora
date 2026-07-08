import { LockKeyhole } from "lucide-react";
import { Link } from "react-router";

import { Button } from "~/components/ui/button/button";
import type { PublicAskState } from "~/features/profiles/types/profiles.types";

interface PermissionStateProps {
  ask: Extract<PublicAskState, { status: "denied" }>;
}

export function PermissionState({ ask }: PermissionStateProps) {
  return (
    <section
      aria-labelledby="ask-permission-title"
      className="flex flex-col gap-4 rounded-3xl border bg-card p-6 text-card-foreground shadow-[var(--shadow-card)] sm:p-7"
      id="ask"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
          <LockKeyhole aria-hidden="true" className="size-5" />
        </span>
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold" id="ask-permission-title">
            Questions unavailable
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">{ask.message}</p>
        </div>
      </div>
      {ask.action === undefined ? null : (
        <Button asChild className="w-fit" variant="outline">
          <Link to={ask.action.href}>{ask.action.label}</Link>
        </Button>
      )}
    </section>
  );
}
