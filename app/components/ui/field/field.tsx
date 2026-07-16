import * as React from "react";

import { cn } from "~/lib/utils";

function FieldGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col gap-4", className)}
      data-slot="field-group"
      {...props}
    />
  );
}

function Field({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col gap-2", className)}
      data-slot="field"
      {...props}
    />
  );
}

function FieldLabel({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      className={cn("text-sm font-medium leading-none", className)}
      data-slot="field-label"
      {...props}
    />
  );
}

function FieldDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("text-sm leading-6 text-muted-foreground", className)}
      data-slot="field-description"
      {...props}
    />
  );
}

interface FieldErrorProps extends React.ComponentProps<"p"> {
  message?: string | undefined;
}

/**
 * Inline validation message. Renders an empty placeholder element when there
 * is no message so aria-describedby ids stay valid.
 */
function FieldError({ className, message, ...props }: FieldErrorProps) {
  if (message === undefined) {
    return <span data-slot="field-error" {...props} />;
  }

  return (
    <p
      className={cn("text-sm leading-6 text-destructive", className)}
      data-slot="field-error"
      role="alert"
      {...props}
    >
      {message}
    </p>
  );
}

export { Field, FieldDescription, FieldError, FieldGroup, FieldLabel };
