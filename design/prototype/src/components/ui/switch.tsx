import * as React from "react";

import { cn } from "../../lib/utils";

type SwitchProps = Omit<React.ComponentProps<"button">, "onChange"> & {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
};

export function Switch({
  checked = false,
  className,
  onCheckedChange,
  ...props
}: SwitchProps) {
  return (
    <button
      aria-checked={checked}
      className={cn(
        "inline-flex h-[22px] w-[38px] shrink-0 items-center rounded-full border border-transparent bg-border-strong p-[3px] outline-none transition-colors duration-200 focus-visible:ring-[3px] focus-visible:ring-ring/25 data-[state=checked]:bg-primary disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      data-slot="switch"
      data-state={checked ? "checked" : "unchecked"}
      onClick={() => {
        onCheckedChange?.(!checked);
      }}
      role="switch"
      type="button"
      {...props}
    >
      <span
        className="size-4 rounded-full bg-white shadow-sm transition-transform duration-200 data-[state=checked]:translate-x-4"
        data-state={checked ? "checked" : "unchecked"}
      />
    </button>
  );
}
