import { useId, useState } from "react";

import { Switch } from "~/components/ui/switch/switch";
import { cn } from "~/lib/utils";

type IdentityChoice = "anonymous" | "attributed";

interface IdentitySwitchProps {
  defaultIdentity: IdentityChoice;
  name?: string;
  error?: string | undefined;
  className?: string | undefined;
  variant?: "card" | "inline" | undefined;
}

export function IdentitySwitch({
  className,
  defaultIdentity,
  error,
  name = "identityMode",
  variant = "card",
}: IdentitySwitchProps) {
  const [isAnonymous, setIsAnonymous] = useState(
    defaultIdentity === "anonymous",
  );
  const labelId = useId();
  const descriptionId = useId();
  const errorId = useId();

  if (variant === "inline") {
    return (
      <div
        className={cn("flex items-center gap-2", className)}
        data-slot="identity-switch"
      >
        <Switch
          aria-describedby={
            error === undefined ? descriptionId : `${descriptionId} ${errorId}`
          }
          aria-labelledby={labelId}
          checked={isAnonymous}
          data-identity={isAnonymous ? "anonymous" : "attributed"}
          onCheckedChange={setIsAnonymous}
        />
        <span
          className="text-xs font-semibold leading-5 text-foreground"
          id={labelId}
        >
          {isAnonymous ? "Anonymous" : "Your profile"}
        </span>
        <span className="sr-only" id={descriptionId}>
          {isAnonymous
            ? "Hidden from the recipient and public viewers."
            : "Your profile is attached if this is answered."}
        </span>
        <input
          name={name}
          type="hidden"
          value={isAnonymous ? "anonymous" : "attributed"}
        />
        {error === undefined ? null : (
          <span
            className="text-xs leading-5 text-destructive"
            id={errorId}
            role="alert"
          >
            {error}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn("flex flex-col gap-2", className)}
      data-slot="identity-switch"
    >
      <div className="flex items-center justify-between gap-4 rounded-xl border bg-card px-4 py-3">
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-medium text-foreground" id={labelId}>
            {isAnonymous ? "Anonymous" : "Your profile"}
          </span>
          <span
            className="text-sm leading-5 text-muted-foreground"
            id={descriptionId}
          >
            {isAnonymous
              ? "Hidden from the recipient and public viewers."
              : "Your profile is attached if this is answered."}
          </span>
        </span>
        <Switch
          aria-describedby={
            error === undefined ? descriptionId : `${descriptionId} ${errorId}`
          }
          aria-labelledby={labelId}
          checked={isAnonymous}
          data-identity={isAnonymous ? "anonymous" : "attributed"}
          onCheckedChange={setIsAnonymous}
        />
      </div>
      <input
        name={name}
        type="hidden"
        value={isAnonymous ? "anonymous" : "attributed"}
      />
      {error === undefined ? null : (
        <p
          className="text-sm leading-6 text-destructive"
          id={errorId}
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}
