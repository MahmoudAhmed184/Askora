import type { ReactNode } from "react";
import { ArrowRight, UserRound } from "lucide-react";
import { Link, useRouteLoaderData } from "react-router";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import type { loader as rootLoader, RootLoaderData } from "~/root";

interface PublicShellProps {
  children: ReactNode;
  showSessionEntry?: boolean;
}

export function PublicShell({
  children,
  showSessionEntry = true,
}: PublicShellProps) {
  const rootData = useRouteLoaderData<typeof rootLoader>("root");
  const session = rootData?.session;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur-md">
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
            {showSessionEntry ? (
              <PublicSessionEntry session={session} />
            ) : (
              <Badge variant="secondary">Private beta</Badge>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        {children}
      </main>
      <footer className="border-t bg-surface/70">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
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

type PublicSession = RootLoaderData["session"];

function PublicSessionEntry({ session }: { session: PublicSession | undefined }) {
  if (session?.status !== "authenticated") {
    return (
      <Button asChild className="px-4" size="sm">
        <Link to="/login">
          Log in
          <ArrowRight data-icon="inline-end" />
        </Link>
      </Button>
    );
  }

  if (session.profileStatus === "incomplete") {
    return (
      <Button asChild className="px-4" size="sm" variant="secondary">
        <Link to="/setup">
          Complete setup
          <ArrowRight data-icon="inline-end" />
        </Link>
      </Button>
    );
  }

  return (
    <Button asChild className="gap-2 px-2 pr-3" size="sm" variant="secondary">
      <Link aria-label={`Open ${session.profile.displayName}'s profile`} to={`/${session.profile.username}`}>
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary font-serif text-xs font-bold text-primary-foreground">
          {getInitial(session.profile.displayName)}
        </span>
        <span className="hidden max-w-28 truncate sm:inline">
          {session.profile.displayName}
        </span>
        <UserRound data-icon="inline-end" />
      </Link>
    </Button>
  );
}

function getInitial(value: string) {
  return value.trim().slice(0, 1).toUpperCase() || "Q";
}
