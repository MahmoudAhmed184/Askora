import { cva } from "class-variance-authority";

export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-transparent text-sm font-bold outline-none transition-[background-color,border-color,color,box-shadow,opacity,transform] duration-200 ease-out hover:-translate-y-px focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 active:translate-y-px disabled:pointer-events-none disabled:translate-y-0 disabled:opacity-45 motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:translate-y-0 [&_[data-icon]]:size-4 [&_svg:not([class*='text-'])]:text-current [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_4px_14px_var(--accent-glow)] hover:bg-primary/95 hover:shadow-[0_6px_20px_var(--accent-glow)]",
        destructive:
          "bg-destructive text-destructive-foreground shadow-[0_4px_14px_color-mix(in_oklch,var(--destructive)_18%,transparent)] hover:bg-destructive/90 hover:shadow-[0_6px_20px_color-mix(in_oklch,var(--destructive)_20%,transparent)]",
        outline:
          "border-border bg-transparent text-foreground hover:border-primary/45 hover:bg-surface",
        secondary: "bg-muted text-foreground hover:bg-muted/80",
        ghost: "text-foreground hover:bg-surface",
        link: "h-auto rounded-none px-0 py-0 text-primary underline-offset-4 hover:underline",
        subtle:
          "border-border bg-surface text-foreground hover:border-border/80 hover:bg-muted",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3.5 text-xs",
        lg: "h-11 px-5",
        icon: "size-10 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);
