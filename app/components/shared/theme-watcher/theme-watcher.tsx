import { useEffect } from "react";

import { getStoredThemePreference } from "~/lib/theme";

/**
 * Keeps the document theme in sync with the OS setting while the app is open,
 * for users without an explicit light/dark override. Mounted once in root.
 */
export function ThemeWatcher() {
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    function handleChange() {
      if (getStoredThemePreference() !== "system") {
        return;
      }

      document.documentElement.classList.toggle("dark", media.matches);
    }

    media.addEventListener("change", handleChange);

    return () => {
      media.removeEventListener("change", handleChange);
    };
  }, []);

  return null;
}
