import { Check } from "lucide-react";

import { cn } from "~/lib/utils";

export type SetupStep = "profile" | "share" | "feed";

interface SetupProgressProps {
  activeStep: SetupStep;
}

const setupSteps = [
  { id: "profile", label: "Profile" },
  { id: "share", label: "Share" },
  { id: "feed", label: "Feed" },
] as const satisfies readonly { id: SetupStep; label: string }[];

export function SetupProgress({ activeStep }: SetupProgressProps) {
  const activeIndex = setupSteps.findIndex((step) => step.id === activeStep);

  return (
    <nav aria-label="Profile setup progress">
      <ol className="flex flex-wrap gap-2">
        {setupSteps.map((step, index) => {
          const isComplete = index < activeIndex;
          const isActive = step.id === activeStep;

          return (
            <li
              aria-current={isActive ? "step" : undefined}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs font-bold text-muted-foreground",
                isActive && "border-primary bg-primary/10 text-primary",
                isComplete && "text-foreground",
              )}
              key={step.id}
            >
              <span
                className={cn(
                  "flex size-5 items-center justify-center rounded-full bg-secondary text-[0.68rem] text-secondary-foreground",
                  (isActive || isComplete) &&
                    "bg-primary text-primary-foreground",
                )}
              >
                {isComplete ? <Check data-icon="inline-start" /> : index + 1}
              </span>
              {step.label}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
