import { FileText, Filter, Inbox } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";

import { Badge } from "~/components/ui/badge/badge";
import { cn } from "~/lib/utils";

export type InboxWorkflowFolder = "inbox" | "drafts" | "filtered";

interface InboxWorkflowNavProps {
  active: InboxWorkflowFolder;
  counts?: Partial<Record<InboxWorkflowFolder, number>> | undefined;
}

interface InboxWorkflowShellProps extends InboxWorkflowNavProps {
  children: ReactNode;
  description: string;
  locked?: boolean | undefined;
}

const inboxWorkflowLinks = [
  {
    id: "inbox",
    label: "All Questions",
    to: "/inbox",
    icon: Inbox,
  },
  {
    id: "drafts",
    label: "Drafts",
    to: "/drafts",
    icon: FileText,
  },
  {
    id: "filtered",
    label: "Filtered",
    to: "/filtered",
    icon: Filter,
  },
] as const satisfies readonly {
  id: InboxWorkflowFolder;
  label: string;
  to: string;
  icon: LucideIcon;
}[];

export function InboxWorkflowShell({
  active,
  children,
  counts,
  description,
  locked = false,
}: InboxWorkflowShellProps) {
  return (
    <div className="mx-auto -mt-8 flex w-full max-w-2xl flex-col sm:-mt-10">
      <header className="sticky top-0 z-30 -mx-4 border-b bg-background/85 px-4 pt-8 backdrop-blur-md supports-[backdrop-filter]:bg-background/76 sm:-mx-6 sm:px-6 sm:pt-10 lg:-mx-8 lg:px-8">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-3">
          <div className="flex min-w-0 flex-wrap items-center justify-center gap-2">
            <h1 className="font-serif text-3xl font-bold leading-none text-primary">
              Inbox
            </h1>
            {locked ? <Badge variant="outline">Locked</Badge> : null}
          </div>
          <p className="sr-only">{description}</p>
          <InboxWorkflowNav active={active} counts={counts} />
        </div>
      </header>

      <div className="flex flex-col gap-6 pt-8">{children}</div>
    </div>
  );
}

export function InboxWorkflowNav({ active, counts }: InboxWorkflowNavProps) {
  return (
    <nav
      aria-label="Inbox workflow"
      className="no-scrollbar -mb-px flex max-w-full justify-center gap-1 overflow-x-auto"
    >
      {inboxWorkflowLinks.map((link) => {
        const isActive = link.id === active;
        const Icon = link.icon;
        const count = counts?.[link.id];

        return (
          <Link
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "group relative inline-flex shrink-0 items-center gap-2 px-4 py-3 text-xs font-bold transition-colors after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:transition-colors",
              isActive
                ? "text-primary after:bg-primary"
                : "text-muted-foreground after:bg-transparent hover:text-foreground",
              link.id === "filtered" && !isActive && "text-destructive/75",
            )}
            key={link.id}
            to={link.to}
          >
            <Icon
              className="hidden size-3.5 shrink-0 sm:block"
              data-icon="inline-start"
            />
            <span>{link.label}</span>
            {count === undefined ? null : (
              <Badge
                className={cn(
                  "border-transparent px-2 py-0.5 text-[0.625rem] transition-colors",
                  isActive
                    ? "bg-secondary text-primary"
                    : "bg-secondary text-secondary-foreground group-hover:text-foreground",
                )}
                variant="secondary"
              >
                {count}
              </Badge>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
