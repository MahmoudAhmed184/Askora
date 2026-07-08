import { CheckCircle2 } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";

import { Badge } from "~/components/ui/badge/badge";
import {
  SetupProgress,
  type SetupStep,
} from "~/features/profile-setup/components/setup-progress";

interface OnboardingShellProps {
  activeStep: SetupStep;
  children: ReactNode;
}

export function OnboardingShell({
  activeStep,
  children,
}: OnboardingShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b bg-background/88 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6 lg:px-8">
          <Link
            className="flex min-w-0 items-center gap-2.5 text-sm font-semibold text-foreground"
            to="/"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary font-serif text-base font-bold text-primary-foreground">
              Q
            </span>
            <span className="truncate">Q&A Platform</span>
          </Link>
          <OnboardingStatus activeStep={activeStep} />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <OnboardingAccessHeader activeStep={activeStep} />
        {children}
      </main>
    </div>
  );
}

function OnboardingStatus({ activeStep }: { activeStep: SetupStep }) {
  if (activeStep === "share" || activeStep === "feed") {
    return (
      <Badge className="gap-1.5" variant="secondary">
        <CheckCircle2 aria-hidden="true" className="size-3.5" />
        Profile ready
      </Badge>
    );
  }

  return <span className="text-sm text-muted-foreground">Setup</span>;
}

function OnboardingAccessHeader({ activeStep }: { activeStep: SetupStep }) {
  return (
    <section className="overflow-hidden rounded-3xl border bg-card text-card-foreground shadow-[var(--shadow-card)]">
      <div
        aria-hidden="true"
        className="relative h-28 bg-[linear-gradient(135deg,oklch(0.70_0.13_310),oklch(0.50_0.15_295))] sm:h-40"
      >
        <div className="absolute inset-0 opacity-15 [background-image:linear-gradient(to_right,var(--primary)_1px,transparent_1px),linear-gradient(to_bottom,var(--primary)_1px,transparent_1px)] [background-size:20px_20px]" />
      </div>
      <div className="p-5 pt-0 sm:p-7 sm:pt-0">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="relative z-10 -mt-11 flex size-20 shrink-0 items-center justify-center rounded-full border-4 border-card bg-secondary font-serif text-2xl font-extrabold text-primary shadow-[0_4px_12px_rgb(0_0_0/0.06)] sm:-mt-14 sm:size-24 sm:text-3xl">
            QA
          </div>
          <div className="min-w-0 flex-1 sm:pt-5">
            <h1 className="font-serif text-3xl font-extrabold leading-tight text-foreground sm:text-4xl">
              Beta Entry
            </h1>
            <p className="mt-1 font-mono text-sm text-muted-foreground">
              invite gate · setup · share · feed
            </p>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
              Claim a stable public profile, then share one canonical link when
              setup is complete.
            </p>
          </div>
        </div>
        <div className="mt-5">
          <SetupProgress activeStep={activeStep} />
        </div>
      </div>
    </section>
  );
}
