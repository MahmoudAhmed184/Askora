import type { ReactNode } from "react";
import { NavLink } from "react-router";

import { DashboardShell } from "~/components/app/dashboard-shell";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

interface SettingsShellProps {
  title: string;
  description: string;
  isSuspended: boolean;
  children: ReactNode;
}

const settingsLinks = [
  { to: "/dashboard/settings/profile", label: "Profile" },
  { to: "/dashboard/settings/privacy", label: "Privacy" },
  { to: "/dashboard/settings/safety", label: "Safety" },
  { to: "/dashboard/settings/account", label: "Account" },
] as const;

export function SettingsShell({
  title,
  description,
  isSuspended,
  children,
}: SettingsShellProps) {
  return (
    <DashboardShell>
      <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start">
        <aside className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Settings</Badge>
            {isSuspended ? <Badge variant="outline">Locked</Badge> : undefined}
          </div>
          <nav aria-label="Settings navigation" className="flex gap-2 lg:flex-col">
            {settingsLinks.map((link) => (
              <NavLink
                className={({ isActive }) =>
                  cn(
                    "rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "border-foreground/15 bg-background text-foreground"
                      : "border-transparent text-muted-foreground hover:bg-background hover:text-foreground",
                  )
                }
                key={link.to}
                to={link.to}
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <section className="flex min-w-0 flex-col gap-6">
          <div className="flex flex-col gap-2 border-b pb-5">
            <h1 className="text-3xl font-semibold tracking-normal">{title}</h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          </div>
          {children}
        </section>
      </div>
    </DashboardShell>
  );
}
