import type { ReactNode } from "react";
import { Link, useLocation } from "react-router";

import { cn } from "~/lib/utils";

interface AdminShellProps {
  children: ReactNode;
}

export function AdminShell({ children }: AdminShellProps) {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-card">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-5 py-4">
          <Link className="text-sm font-semibold" to="/">
            qna-platform admin
          </Link>
          <nav aria-label="Admin navigation" className="flex gap-1 text-sm">
            <Link
              aria-current={
                location.pathname === "/admin" ? "page" : undefined
              }
              className={cn(
                "rounded-md px-3 py-2 font-medium transition-colors",
                location.pathname === "/admin"
                  ? "bg-surface text-foreground"
                  : "text-muted-foreground hover:bg-surface hover:text-foreground",
              )}
              to="/admin"
            >
              Reports
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-5 py-6">{children}</main>
    </div>
  );
}
