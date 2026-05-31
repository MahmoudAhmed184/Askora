import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router";

import { Button } from "~/components/ui/button";

interface PublicShellProps {
  children: ReactNode;
}

export function PublicShell({ children }: PublicShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <Link
            className="flex items-center gap-2.5 text-sm font-semibold text-foreground"
            to="/"
          >
            <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground">
              Q
            </span>
            <span>Q&A Platform</span>
          </Link>
          <nav aria-label="Public navigation" className="flex items-center gap-5">
            <Link
              className="hidden text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
              to="/terms"
            >
              Terms
            </Link>
            <Link
              className="hidden text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
              to="/privacy"
            >
              Privacy
            </Link>
            <Button asChild className="px-4" size="sm">
              <Link to="/login">
                Log in
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 sm:py-12">
        {children}
      </main>
      <footer className="border-t bg-card/35">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-5 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>Invite-only beta.</p>
          <div className="flex items-center gap-4 sm:hidden">
            <Link className="hover:text-foreground" to="/terms">
              Terms
            </Link>
            <Link className="hover:text-foreground" to="/privacy">
              Privacy
            </Link>
          </div>
          <p className="sm:text-right">
            Anonymous to recipients and public viewers, not to the platform.
          </p>
        </div>
      </footer>
    </div>
  );
}
