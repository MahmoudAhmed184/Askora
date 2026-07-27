import type { ReactNode } from "react";
import { Link } from "react-router";

import { BrandLogo } from "~/components/shared/brand-logo/brand-logo";

interface OnboardingShellProps {
  children: ReactNode;
}

export function OnboardingShell({ children }: OnboardingShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b bg-background/88 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-5xl items-center px-4 py-3.5 sm:px-6 lg:px-8">
          <Link className="flex min-w-0 items-center" to="/">
            <BrandLogo />
          </Link>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        {children}
      </main>
    </div>
  );
}
