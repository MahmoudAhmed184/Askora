import { ChevronDown } from "lucide-react";
import * as React from "react";

import { cn } from "~/lib/utils";

/**
 * Styled native select. Forms in this app post as plain HTML forms, so the
 * control stays a real <select> element instead of a scripted listbox.
 */
function Select({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative w-full">
      <select
        className={cn(
          "flex h-10 w-full min-w-0 appearance-none rounded-xl border border-input bg-card px-3 py-2 pr-9 text-sm outline-none transition-[border-color,box-shadow] duration-200 ease-out focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20",
          className,
        )}
        data-slot="select"
        {...props}
      />
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}

export { Select };
