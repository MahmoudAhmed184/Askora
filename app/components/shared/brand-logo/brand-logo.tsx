import { cn } from "~/lib/utils";

interface BrandLogoProps {
  className?: string;
}

export function BrandLogo({ className }: BrandLogoProps) {
  return (
    <span
      aria-label="Askora"
      className={cn("inline-flex h-8 shrink-0 items-center", className)}
      role="img"
    >
      <img
        alt=""
        aria-hidden="true"
        className="h-full w-auto object-contain dark:hidden"
        decoding="async"
        height="329"
        src="/askora-logo-light.png"
        width="1413"
      />
      <img
        alt=""
        aria-hidden="true"
        className="hidden h-full w-auto object-contain dark:block"
        decoding="async"
        height="272"
        src="/askora-logo-dark.png"
        width="1167"
      />
    </span>
  );
}
