import type { ReactNode } from "react";
import { Link } from "react-router";

interface DashboardShellProps {
  children: ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
  return (
    <div className="min-h-screen bg-surface text-foreground">
      <header className="border-b bg-background">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <Link className="text-sm font-semibold" to="/">
            qna-platform
          </Link>
          <nav aria-label="Dashboard navigation" className="flex gap-4 text-sm">
            <span className="text-muted-foreground">Dashboard shell</span>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-5 py-6">{children}</main>
    </div>
  );
}
