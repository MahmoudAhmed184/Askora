import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router";

import { Button } from "~/components/ui/button/button";

interface UnavailableStateProps {
  title: string;
  description: string;
  action?: ReactNode;
  meta?: string;
}

/**
 * Full-page fallback for content that cannot be shown (missing, private, or
 * removed). Keeps the copy calm and offers a way back.
 */
export function UnavailableState({
  action,
  description,
  meta,
  title,
}: UnavailableStateProps) {
  return (
    <div className="mx-auto flex min-h-[50svh] w-full max-w-xl flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      {meta === undefined ? null : (
        <p className="break-all text-sm font-medium text-muted-foreground">
          {meta}
        </p>
      )}
      <h1 className="font-serif text-3xl font-bold leading-tight text-foreground">
        {title}
      </h1>
      <p className="max-w-prose text-sm leading-6 text-muted-foreground">
        {description}
      </p>
      {action ?? (
        <Button asChild variant="outline">
          <Link to="/">
            <ArrowLeft data-icon="inline-start" />
            Back to home
          </Link>
        </Button>
      )}
    </div>
  );
}
