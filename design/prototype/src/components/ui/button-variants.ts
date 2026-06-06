import { cva } from "class-variance-authority";

export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-transparent text-sm font-bold outline-none transition-[background-color,border-color,color,box-shadow,opacity,transform] duration-200 ease-out focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 active:translate-y-px disabled:pointer-events-none disabled:translate-y-0 disabled:opacity-45 [&_[data-icon]]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    defaultVariants: {
      size: "default",
      variant: "default",
    },
    variants: {
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-11 px-5",
        icon: "size-10 p-0",
      },
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_2px_10px_oklch(0.38_0.12_295_/_0.15)] hover:bg-primary/95",
        destructive:
          "bg-destructive text-destructive-foreground shadow-[0_2px_10px_oklch(0.55_0.22_25_/_0.18)] hover:bg-destructive/90",
        ghost: "text-foreground hover:bg-surface",
        link: "h-auto rounded-none px-0 py-0 text-primary underline-offset-4 hover:underline",
        outline:
          "border-border bg-transparent text-foreground hover:border-primary/45 hover:bg-surface",
        secondary: "bg-muted text-foreground hover:bg-muted/80",
        subtle:
          "border-border bg-surface text-foreground hover:border-border/80 hover:bg-muted",
      },
    },
  },
);
