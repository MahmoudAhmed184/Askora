import * as React from "react";

import { cn } from "../lib/utils";

export type FloatingPillNavItem = {
  value: string;
  label: string;
  mobileLabel?: string;
  href?: string;
  hasIndicator?: boolean;
  disabled?: boolean;
};

type FloatingPillNavProps = {
  items: readonly FloatingPillNavItem[];
  activeValue: string;
  onValueChange?: (value: string) => void;
  ariaLabel?: string;
  className?: string;
};

export function FloatingPillNav({
  items,
  activeValue,
  onValueChange,
  ariaLabel = "Primary navigation",
  className,
}: FloatingPillNavProps) {
  const navRef = React.useRef<HTMLElement | null>(null);
  const itemRefs = React.useRef(new Map<string, HTMLElement>());
  const [capsuleStyle, setCapsuleStyle] = React.useState<React.CSSProperties>();

  React.useLayoutEffect(() => {
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
        "fixed inset-x-4 bottom-5 z-50 mx-auto flex max-w-[35rem] items-center justify-between gap-1 rounded-full border border-primary/15 bg-card/90 p-1.5 shadow-[0_12px_36px_oklch(0.16_0.035_295_/_0.10)] backdrop-blur-md sm:bottom-7 sm:max-w-[42rem]",
        className,
      )}
      data-slot="floating-pill-nav"
      ref={navRef}
    >
      <span
        aria-hidden="true"
        className="absolute rounded-full bg-primary shadow-[0_4px_12px_oklch(0.38_0.12_295_/_0.15)] transition-[height,left,top,width] duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]"
        data-slot="floating-pill-nav-capsule"
        style={capsuleStyle}
      />

      {items.map((item) => {
        const isActive = item.value === activeValue;
        const sharedClassName = cn(
          "relative z-10 inline-flex h-10 min-w-0 flex-1 items-center justify-center rounded-full px-2 text-xs font-bold leading-none text-muted-foreground outline-none transition-[color,transform] duration-200 ease-out focus-visible:ring-[3px] focus-visible:ring-ring/35 disabled:pointer-events-none disabled:opacity-45 sm:px-3 sm:text-[0.84rem]",
          "hover:text-foreground active:translate-y-px",
          isActive && "text-primary-foreground hover:text-primary-foreground",
        );

        const content = (
          <>
            {item.hasIndicator ? (
              <span
                aria-hidden="true"
                className="absolute -top-2 left-1/2 size-3 -translate-x-1/2 rounded-full bg-accent shadow-[0_0_0_4px_var(--card)] sm:-top-3"
              />
            ) : null}
            {item.mobileLabel ? (
              <>
                <span className="whitespace-nowrap sm:hidden">
                  {item.mobileLabel}
                </span>
                <span className="hidden whitespace-nowrap sm:inline">
                  {item.label}
                </span>
              </>
            ) : (
              <span className="whitespace-nowrap">{item.label}</span>
            )}
          </>
        );

        if (item.href) {
          return (
            <a
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
              className={sharedClassName}
              data-active={isActive ? "" : undefined}
              data-slot="floating-pill-nav-link"
              href={item.href}
              key={item.value}
              onClick={() => {
                onValueChange?.(item.value);
              }}
              ref={(node) => {
                if (node) {
                  itemRefs.current.set(item.value, node);
                } else {
                  itemRefs.current.delete(item.value);
                }
              }}
            >
              {content}
            </a>
          );
        }

        return (
          <button
            aria-label={item.label}
            aria-current={isActive ? "page" : undefined}
            className={sharedClassName}
            data-active={isActive ? "" : undefined}
            data-slot="floating-pill-nav-button"
            disabled={item.disabled}
            key={item.value}
            onClick={() => {
              onValueChange?.(item.value);
            }}
            ref={(node) => {
              if (node) {
                itemRefs.current.set(item.value, node);
              } else {
                itemRefs.current.delete(item.value);
              }
            }}
            type="button"
          >
            {content}
          </button>
        );
      })}
    </nav>
  );
}
