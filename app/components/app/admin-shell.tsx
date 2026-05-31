import type { ReactNode } from "react";
import { Link } from "react-router";

interface AdminShellProps {
  children: ReactNode;
}

export function AdminShell({ children }: AdminShellProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-card">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-5 py-4">
          <Link className="text-sm font-semibold" to="/">
            qna-platform admin
          </Link>
          <span className="text-sm text-muted-foreground">
            Moderation tools are not enabled in this slice.
          </span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-5 py-6">{children}</main>
    </div>
  );
}
