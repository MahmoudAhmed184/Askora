import type { LucideIcon } from "lucide-react";
import * as React from "react";
import { Link } from "react-router";

import { cn } from "~/lib/utils";

export interface FloatingPillNavItem {
  value: string;
  label: string;
  to: string;
  icon: LucideIcon;
  hasIndicator?: boolean | undefined;
}

interface FloatingPillNavProps {
  items: readonly FloatingPillNavItem[];
  activeValue: string;
  ariaLabel?: string | undefined;
  className?: string | undefined;
  pendingValue?: string | undefined;
}

const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? React.useEffect : React.useLayoutEffect;

export function FloatingPillNav({
  items,
  activeValue,
  ariaLabel = "Primary navigation",
  className,
  pendingValue,
}: FloatingPillNavProps) {
  const navRef = React.useRef<HTMLElement | null>(null);
  const itemRefs = React.useRef(new Map<string, HTMLAnchorElement>());
  const [capsuleStyle, setCapsuleStyle] = React.useState<React.CSSProperties>();

  useIsomorphicLayoutEffect(() => {
    function repositionCapsule() {
      const nav = navRef.current;
      const activeItem = itemRefs.current.get(activeValue);

      if (!nav || !activeItem) {
        return;
      }

      const navRect = nav.getBoundingClientRect();
      const itemRect = activeItem.getBoundingClientRect();

      setCapsuleStyle({
        height: itemRect.height,
        left: itemRect.left - navRect.left,
        top: itemRect.top - navRect.top,
        width: itemRect.width,
      });
    }

    repositionCapsule();
    window.addEventListener("resize", repositionCapsule);

    return () => {
      window.removeEventListener("resize", repositionCapsule);
    };
  }, [activeValue, items]);

  return (
    <nav
      aria-label={ariaLabel}
      className={cn(
        "fixed inset-x-4 bottom-[calc(1.25rem+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-[35rem] items-center justify-between gap-1 rounded-full border border-primary/15 bg-card/90 p-1.5 shadow-[var(--shadow-navbar)] backdrop-blur-md sm:bottom-7 sm:max-w-[46rem]",
        className,
      )}
      data-active-value={activeValue}
      data-slot="floating-pill-nav"
      ref={navRef}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute rounded-full bg-primary shadow-[0_4px_12px_var(--accent-glow)] transition-[height,left,top,width] duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] motion-reduce:transition-none",
          capsuleStyle === undefined && "hidden",
        )}
        data-slot="floating-pill-nav-capsule"
        style={capsuleStyle}
      />

      {items.map((item) => {
        const isActive = item.value === activeValue;
        const isPending = item.value === pendingValue;
        const Icon = item.icon;

        return (
          <Link
            aria-current={isActive ? "page" : undefined}
            aria-label={item.label}
            className={cn(
              "relative z-10 inline-flex h-11 min-w-11 flex-1 items-center justify-center gap-2 rounded-full px-1 text-xs font-bold leading-none text-muted-foreground outline-none transition-[background-color,color,transform] duration-200 ease-out hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/35 active:translate-y-px motion-reduce:transition-none motion-reduce:active:translate-y-0 sm:h-10 sm:px-3 sm:text-[0.84rem]",
              isActive &&
                "text-primary-foreground hover:text-primary-foreground",
              isActive && capsuleStyle === undefined && "bg-primary",
              isPending && !isActive && "text-foreground",
            )}
            data-active={isActive ? "" : undefined}
            data-pending={isPending ? "" : undefined}
            data-slot="floating-pill-nav-link"
            key={item.value}
            prefetch="intent"
            ref={(node) => {
              if (node) {
                itemRefs.current.set(item.value, node);
              } else {
                itemRefs.current.delete(item.value);
              }
            }}
            to={item.to}
          >
            {isPending && !isActive ? (
              <span
                aria-hidden="true"
                className="absolute bottom-1.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-primary"
              />
            ) : null}
            {item.hasIndicator ? (
              <span
                aria-hidden="true"
                className="absolute -top-2 left-1/2 size-3 -translate-x-1/2 rounded-full bg-accent shadow-[0_0_0_4px_var(--card)] sm:-top-3"
              />
            ) : null}
            <Icon
              aria-hidden="true"
              className="size-5 shrink-0"
              data-slot="floating-pill-nav-icon"
              strokeWidth={isActive ? 2.4 : 2}
            />
            <span
              className="sr-only sm:not-sr-only sm:whitespace-nowrap"
              data-slot="floating-pill-nav-label"
            >
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
