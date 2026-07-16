import * as React from "react";

import { cn } from "~/lib/utils";

function Separator({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      aria-hidden="true"
      className={cn("h-px w-full bg-border", className)}
      data-slot="separator"
      {...props}
    />
  );
}

export { Separator };
