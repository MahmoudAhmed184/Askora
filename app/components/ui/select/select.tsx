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

const EMPTY_VALUE_SENTINEL = "__askora_select_empty__";
const SELECT_OPEN_EVENT = "askora:select-open";

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
  const emptyValue = getEmptyValueSentinel(options);
  const initialValue = value === undefined ? String(defaultValue ?? "") : String(value);
  const [uncontrolledValue, setUncontrolledValue] = React.useState(initialValue);
  const [open, setOpen] = React.useState(false);
  const instanceId = React.useId();
  const hydrated = React.useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const selectedValue = value === undefined ? uncontrolledValue : String(value);

  React.useEffect(() => {
    function closeWhenAnotherSelectOpens(event: Event) {
      if (
        event instanceof CustomEvent &&
        event.detail !== instanceId
      ) {
        setOpen(false);
      }
    }

    document.addEventListener(SELECT_OPEN_EVENT, closeWhenAnotherSelectOpens);

    return () => {
      document.removeEventListener(
        SELECT_OPEN_EVENT,
        closeWhenAnotherSelectOpens,
      );
    };
  }, [instanceId]);

  function handleValueChange(nextValue: string) {
    if (value === undefined) {
      setUncontrolledValue(nextValue);
    }

    onValueChange?.(nextValue);
  }

  const nativeSelect = (
    <select
      aria-describedby={triggerProps["aria-describedby"]}
      aria-invalid={triggerProps["aria-invalid"]}
      aria-label={triggerProps["aria-label"]}
      aria-labelledby={triggerProps["aria-labelledby"]}
      className={cn(
        "flex h-10 w-full min-w-0 appearance-none rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      disabled={disabled}
      form={form}
      id={id}
      name={name}
      onChange={(event) => {
        handleValueChange(event.currentTarget.value);
      }}
      required={required}
      value={selectedValue}
    >
      {options.map((option) => (
        <option disabled={option.disabled} key={option.key} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );

  if (!hydrated) {
    return nativeSelect;
  }

  return (
    <>
      {React.cloneElement(nativeSelect, {
        "aria-hidden": true,
        className: "sr-only",
        id: undefined,
        tabIndex: -1,
      })}
      <SelectPrimitive.Root
        {...(defaultValue === undefined
          ? {}
          : { defaultValue: toRadixValue(initialValue, emptyValue) })}
        {...(disabled === undefined ? {} : { disabled })}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);

          if (nextOpen) {
            document.dispatchEvent(
              new CustomEvent(SELECT_OPEN_EVENT, { detail: instanceId }),
            );
          }
        }}
        onValueChange={(nextValue: string) => {
          handleValueChange(fromRadixValue(nextValue, emptyValue));
        }}
        open={open}
        {...(value === undefined
          ? {}
          : { value: toRadixValue(selectedValue, emptyValue) })}
      >
        <SelectPrimitive.Trigger
          className={cn(
            "group pointer-events-auto flex h-10 w-full min-w-0 items-center justify-between gap-3 rounded-xl border border-input bg-card px-3 py-2 text-left text-sm outline-none transition-[border-color,box-shadow,background-color] duration-200 ease-out hover:bg-accent/50 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 data-[placeholder]:text-muted-foreground aria-invalid:border-destructive aria-invalid:ring-destructive/20 motion-reduce:transition-none motion-reduce:duration-0",
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
              className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180 motion-reduce:transition-none motion-reduce:transform-none motion-reduce:duration-0"
            />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>

        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            className="z-[80] max-h-[min(20rem,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-[var(--shadow-card-hover)] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 motion-reduce:animate-none motion-reduce:transition-none motion-reduce:duration-0"
            data-slot="select-content"
            position="popper"
            sideOffset={6}
          >
            <SelectPrimitive.Viewport className="p-1.5">
              {options.map((option) => (
                <SelectPrimitive.Item
                  className="relative flex w-full cursor-pointer select-none items-center rounded-lg py-2 pl-3 pr-9 text-sm outline-none transition-colors hover:bg-primary/10 hover:text-primary data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-primary/10 data-[highlighted]:text-primary motion-reduce:transition-none"
                  disabled={option.disabled}
                  key={option.key}
                  value={toRadixValue(option.value, emptyValue)}
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
    </>
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

function getEmptyValueSentinel(options: ParsedOption[]) {
  let candidate = EMPTY_VALUE_SENTINEL;

  while (options.some((option) => option.value === candidate)) {
    candidate += "_";
  }

  return candidate;
}

function toRadixValue(value: string, emptyValue: string) {
  return value === "" ? emptyValue : value;
}

function fromRadixValue(value: string, emptyValue: string) {
  return value === emptyValue ? "" : value;
}

export { NativeSelect, Select };
