import * as SwitchPrimitive from "@radix-ui/react-switch";
import * as React from "react";

import { cn } from "~/lib/utils";

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-transparent bg-input shadow-inner outline-none transition-[background-color,box-shadow] duration-200 ease-out focus-visible:ring-[3px] focus-visible:ring-ring/35 disabled:cursor-not-allowed disabled:opacity-60 data-[state=checked]:bg-primary motion-reduce:transition-none",
        className,
      )}
      data-slot="switch"
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "pointer-events-none block size-5 rounded-full bg-card shadow-sm ring-0 transition-transform duration-200 ease-out data-[state=checked]:translate-x-[1.375rem] data-[state=unchecked]:translate-x-[0.125rem] motion-reduce:transition-none",
        )}
        data-slot="switch-thumb"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
