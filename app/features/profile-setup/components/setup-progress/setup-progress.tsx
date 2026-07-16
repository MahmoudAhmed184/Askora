import { cn } from "~/lib/utils";

export type SetupStep = "profile" | "share" | "feed";

interface SetupProgressProps {
  activeStep: SetupStep;
}

const setupSteps = [
  { id: "profile", label: "Profile" },
  { id: "share", label: "Share" },
] as const satisfies readonly { id: SetupStep; label: string }[];

/**
 * Compact "Step x of 2" indicator with segmented progress, shown in the
 * onboarding header.
 */
export function SetupProgress({ activeStep }: SetupProgressProps) {
  const activeIndex =
    activeStep === "feed"
      ? setupSteps.length
      : setupSteps.findIndex((step) => step.id === activeStep);
  const currentStep = Math.min(activeIndex + 1, setupSteps.length);
  const currentLabel =
    setupSteps[Math.min(activeIndex, setupSteps.length - 1)]?.label ?? "";

  return (
    <div className="flex items-center gap-3">
      <p className="whitespace-nowrap text-xs font-semibold text-muted-foreground">
        Step {currentStep} of {setupSteps.length}
        <span className="sr-only"> — {currentLabel}</span>
      </p>
      <div
        aria-hidden="true"
        className="flex w-20 items-center gap-1 sm:w-28"
      >
        {setupSteps.map((step, index) => (
          <span
            className={cn(
              "h-1.5 flex-1 rounded-full bg-muted",
              index <= activeIndex && "bg-primary",
            )}
            key={step.id}
          />
        ))}
      </div>
    </div>
  );
}
