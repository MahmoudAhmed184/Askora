import type { ReactNode } from "react";
import { Link } from "react-router";

import {
  SetupProgress,
  type SetupStep,
} from "~/features/profile-setup/components/setup-progress";

interface OnboardingShellProps {
  activeStep: SetupStep;
  children: ReactNode;
}

/**
 * Minimal chrome for the onboarding flow: brand mark, step indicator, and a
 * centered content column. No app navigation until setup is complete.
 */
export function OnboardingShell({
  activeStep,
  children,
}: OnboardingShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b bg-background/88 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6 lg:px-8">
          <Link
            className="flex min-w-0 items-center gap-2.5 text-sm font-semibold text-foreground"
            to="/"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary font-serif text-base font-bold text-primary-foreground">
              Q
            </span>
            <span className="truncate">Q&amp;A Platform</span>
          </Link>
          <SetupProgress activeStep={activeStep} />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        {children}
      </main>
    </div>
  );
}
