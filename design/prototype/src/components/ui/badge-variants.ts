import { cva } from "class-variance-authority";

export const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold leading-none",
  {
    defaultVariants: {
      variant: "default",
    },
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        destructive:
          "border-destructive/20 bg-destructive/10 text-destructive",
        outline: "border-border bg-background text-foreground",
        secondary: "border-transparent bg-muted text-muted-foreground",
        violet: "border-primary/20 bg-primary/10 text-primary",
      },
    },
  },
);
