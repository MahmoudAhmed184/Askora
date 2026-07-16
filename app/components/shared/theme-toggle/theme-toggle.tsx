import { Moon, Sun } from "lucide-react";

import { Button } from "~/components/ui/button/button";
import { applyThemePreference } from "~/lib/theme";
import { cn } from "~/lib/utils";

interface ThemeToggleProps {
  className?: string | undefined;
}

/**
 * Two-state theme switch for pages without settings access. The icons are
 * CSS-driven by the `.dark` root class, so server and client render the same
 * markup and no hydration gate is needed.
 */
export function ThemeToggle({ className }: ThemeToggleProps) {
  return (
    <Button
      aria-label="Toggle light or dark theme"
      className={cn("shrink-0", className)}
      onClick={() => {
        const isDark = document.documentElement.classList.contains("dark");
        applyThemePreference(isDark ? "light" : "dark");
      }}
      size="icon"
      type="button"
      variant="ghost"
    >
      <Sun aria-hidden="true" className="hidden size-4 dark:block" />
      <Moon aria-hidden="true" className="block size-4 dark:hidden" />
    </Button>
  );
}
