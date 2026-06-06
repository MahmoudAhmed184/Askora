import * as React from "react";
import type { VariantProps } from "class-variance-authority";

import { cn } from "../../lib/utils";
import { badgeVariants } from "./badge-variants";

type BadgeProps = React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span
      className={cn(badgeVariants({ className, variant }))}
      data-slot="badge"
      {...props}
    />
  );
}
