import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string | undefined;
  actions?: ReactNode;
  className?: string | undefined;
}

/**
 * Standard signed-in page heading: serif h1, visible supporting line, and an
 * optional trailing action slot.
 */
export function PageHeader({
  actions,
  className,
  description,
  title,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-wrap items-end justify-between gap-x-4 gap-y-3",
        className,
      )}
    >
      <div className="min-w-0 flex-1 basis-64">
        <h1 className="font-serif text-3xl font-bold leading-tight text-foreground">
          {title}
        </h1>
        {description === undefined ? null : (
          <p className="mt-1.5 max-w-prose text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {actions === undefined ? null : (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </header>
  );
}
