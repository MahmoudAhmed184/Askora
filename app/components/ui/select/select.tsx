import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import * as React from "react";

import { cn } from "~/lib/utils";

interface SelectProps {
  "aria-describedby"?: string | undefined;
  "aria-invalid"?: boolean | "true" | "false" | undefined;
  "aria-label"?: string | undefined;
  "aria-labelledby"?: string | undefined;
  children: React.ReactNode;
  className?: string | undefined;
  defaultValue?: string | number | undefined;
  disabled?: boolean | undefined;
  form?: string | undefined;
  id?: string | undefined;
  name?: string | undefined;
  onValueChange?: ((value: string) => void) | undefined;
  required?: boolean | undefined;
  value?: string | number | undefined;
}

interface ParsedOption {
  disabled: boolean;
  key: React.Key;
  label: React.ReactNode;
  value: string;
}

/**
 * App-styled select that keeps keyboard navigation, focus management, and
 * native form submission semantics while avoiding platform-specific popups.
 */
function Select({
  children,
  className,
  defaultValue,
  disabled,
  form,
  id,
  name,
  onValueChange,
  required,
  value,
  ...triggerProps
}: SelectProps) {
  const options = parseOptions(children);
  const placeholder = options.find((option) => option.value === "")?.label;

  return (
    <SelectPrimitive.Root
      {...(defaultValue === undefined
        ? {}
        : { defaultValue: String(defaultValue) })}
      {...(disabled === undefined ? {} : { disabled })}
      {...(form === undefined ? {} : { form })}
      {...(name === undefined ? {} : { name })}
      {...(onValueChange === undefined ? {} : { onValueChange })}
      {...(required === undefined ? {} : { required })}
      {...(value === undefined ? {} : { value: String(value) })}
    >
      <SelectPrimitive.Trigger
        className={cn(
          "group flex h-10 w-full min-w-0 items-center justify-between gap-3 rounded-xl border border-input bg-card px-3 py-2 text-left text-sm outline-none transition-[border-color,box-shadow,background-color] duration-200 ease-out hover:bg-accent/50 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 data-[placeholder]:text-muted-foreground aria-invalid:border-destructive aria-invalid:ring-destructive/20",
          className,
        )}
        data-slot="select-trigger"
        id={id}
        {...triggerProps}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon asChild>
          <ChevronDown
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180"
          />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          className="z-[80] max-h-[min(20rem,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-[var(--shadow-card-hover)] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
          data-slot="select-content"
          position="popper"
          sideOffset={6}
        >
          <SelectPrimitive.Viewport className="p-1.5">
            {options
              .filter((option) => option.value !== "")
              .map((option) => (
                <SelectPrimitive.Item
                  className="relative flex w-full cursor-default select-none items-center rounded-lg py-2 pl-3 pr-9 text-sm outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
                  disabled={option.disabled}
                  key={option.key}
                  value={option.value}
                >
                  <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator className="absolute right-3 inline-flex items-center justify-center text-primary">
                    <Check aria-hidden="true" className="size-4" />
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative w-full">
      <select
        className={cn(
          "flex h-10 w-full min-w-0 appearance-none rounded-xl border border-input bg-card px-3 py-2 pr-9 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}

function parseOptions(children: React.ReactNode): ParsedOption[] {
  return React.Children.toArray(children).flatMap((child, index) => {
    if (!React.isValidElement<React.ComponentProps<"option">>(child)) {
      return [];
    }

    return [{
      disabled: child.props.disabled ?? false,
      key: child.key ?? index,
      label: child.props.children,
      value: String(child.props.value ?? ""),
    }];
  });
}

export { NativeSelect, Select };
