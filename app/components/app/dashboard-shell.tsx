import type { ReactNode } from "react";
import { Link, useLocation } from "react-router";

import { cn } from "~/lib/utils";

interface DashboardShellProps {
  children: ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-surface text-foreground">
      <header className="border-b bg-background">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <Link className="text-sm font-semibold" to="/">
            qna-platform
          </Link>
          <nav
            aria-label="Dashboard navigation"
            className="flex flex-wrap justify-end gap-1 text-sm"
          >
            {dashboardLinks.map((link) => {
              const isActive =
                link.activePrefix === undefined
                  ? location.pathname === link.to
                  : location.pathname.startsWith(link.activePrefix);

              return (
                <Link
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "rounded-md px-3 py-2 font-medium transition-colors",
                    isActive
                      ? "bg-surface text-foreground"
                      : "text-muted-foreground hover:bg-surface hover:text-foreground",
                  )}
                  key={link.to}
                  to={link.to}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-5 py-6">{children}</main>
    </div>
  );
}

interface DashboardLink {
  to: string;
  label: string;
  activePrefix?: string;
}

const dashboardLinks: readonly DashboardLink[] = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/dashboard/inbox", label: "Inbox" },
  { to: "/dashboard/drafts", label: "Drafts" },
  { to: "/dashboard/filtered", label: "Filtered" },
  {
    to: "/dashboard/settings/profile",
    label: "Settings",
    activePrefix: "/dashboard/settings",
  },
] as const;
