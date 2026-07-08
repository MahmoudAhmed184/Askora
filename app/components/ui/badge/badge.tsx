import * as React from "react";
import type { VariantProps } from "class-variance-authority";

import { badgeVariants } from "~/components/ui/badge/badge-variants";
import { cn } from "~/lib/utils";

interface BadgeProps
  extends React.ComponentProps<"span">,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span
      className={cn(badgeVariants({ variant, className }))}
      data-slot="badge"
      {...props}
    />
  );
}
