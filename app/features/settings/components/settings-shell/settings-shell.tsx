import type { ReactNode } from "react";
import {
  LockKeyhole,
  Settings2,
  ShieldCheck,
  SunMoon,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { NavLink, useLocation } from "react-router";

import { Badge } from "~/components/ui/badge/badge";
import { cn } from "~/lib/utils";

interface SettingsShellProps {
  isSuspended: boolean;
  children: ReactNode;
}

const settingsLinks = [
  {
    to: "/settings/profile",
    label: "Profile",
    icon: UserRound,
    description:
      "Manage your public identity, avatar source, and reserved username.",
  },
  {
    to: "/settings/privacy",
    label: "Privacy",
    icon: LockKeyhole,
    description:
      "Control question intake, follow-up permissions, and public count visibility.",
  },
  {
    to: "/settings/safety",
    label: "Safety",
    icon: ShieldCheck,
    description:
      "Pause intake, filter phrases, and review sender blocks created from private-question moderation.",
  },
  {
    to: "/settings/appearance",
    label: "Appearance",
    icon: SunMoon,
    description: "Choose a light, dark, or system theme for this device.",
  },
  {
    to: "/settings/account",
    label: "Account",
    icon: Settings2,
    description: "Manage profile availability and account deletion requests.",
  },
] as const;

export function SettingsShell({ isSuspended, children }: SettingsShellProps) {
  const location = useLocation();
  const panel = getPanelMetadata(location.pathname);

  return (
    <div className="mx-auto w-full max-w-[860px]">
      <header className="mb-8">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-[0.68rem] font-bold uppercase tracking-[0.08em] text-primary">
              Your account
            </p>
            {isSuspended ? <Badge variant="outline">Locked</Badge> : null}
          </div>
          <h1 className="font-serif text-[2rem] font-extrabold leading-none text-foreground sm:text-[2.6rem]">
            Settings
          </h1>
        </div>
      </header>

      <div className="grid gap-6 md:grid-cols-[200px_minmax(0,1fr)] md:items-start">
        <SettingsNavigation />

        <section className="min-w-0 overflow-hidden rounded-3xl border bg-card text-card-foreground shadow-[var(--shadow-card)]">
          <div className="border-b bg-secondary/70 p-5 sm:px-7">
            <h2 className="font-serif text-2xl font-extrabold leading-tight text-foreground">
              {panel.label}
            </h2>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              {panel.description}
            </p>
          </div>
          {children}
        </section>
      </div>
    </div>
  );
}

function SettingsNavigation() {
  // min-w-0 lets this grid item shrink below the pill row's min-content width.
  // Without it the row of non-shrinking tabs sets the column width and the
  // whole page scrolls sideways on narrow screens.
  return (
    <nav
      aria-label="Settings navigation"
      className="min-w-0 md:sticky md:top-6"
    >
      <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-full border bg-card/92 p-1.5 shadow-[var(--shadow-card)] md:flex-col md:gap-0 md:rounded-[1.25rem] md:p-2">
        <div className="hidden px-3 pb-1.5 pt-2 font-mono text-[0.62rem] font-bold uppercase text-muted-foreground md:block">
          Sections
        </div>
        {settingsLinks.map((link) => (
          <SettingsNavigationLink
            icon={link.icon}
            key={link.to}
            label={link.label}
            to={link.to}
          />
        ))}
      </div>
    </nav>
  );
}

function SettingsNavigationLink({
  icon: Icon,
  label,
  to,
}: {
  icon: LucideIcon;
  label: string;
  to: string;
}) {
  return (
    <NavLink
      className={({ isActive, isPending }) =>
        cn(
          // Content-sized on mobile so the row scrolls with readable labels
          // instead of squeezing every tab into an ellipsis.
          "inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full px-4 text-sm font-bold text-muted-foreground transition-colors md:h-auto md:min-h-9 md:w-full md:justify-start md:rounded-xl md:px-3 md:py-2 md:text-[0.84rem]",
          isActive || isPending
            ? "bg-secondary text-primary"
            : "hover:bg-surface hover:text-foreground",
        )
      }
      prefetch="intent"
      to={to}
    >
      <Icon aria-hidden="true" className="hidden size-4 shrink-0 md:block" />
      <span className="truncate whitespace-nowrap">{label}</span>
    </NavLink>
  );
}

function getPanelMetadata(pathname: string) {
  return settingsLinks.find((link) => pathname === link.to) ?? settingsLinks[0];
}
