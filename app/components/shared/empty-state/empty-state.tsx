import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}

export function EmptyState({
  action,
  description,
  icon,
  title,
}: EmptyStateProps) {
  return (
    <section className="flex flex-col items-center gap-4 rounded-3xl border border-dashed bg-card/70 px-6 py-10 text-center">
      {icon === undefined ? null : (
        <span
          aria-hidden="true"
          className="flex size-12 items-center justify-center rounded-full bg-secondary text-primary [&_svg]:size-5"
        >
          {icon}
        </span>
      )}
      <div className="flex flex-col gap-1.5">
        <h2 className="text-lg font-semibold">{title}</h2>
        {description === undefined ? null : (
          <p className="mx-auto max-w-prose text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action}
    </section>
  );
}
