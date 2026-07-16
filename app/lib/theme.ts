export type ThemePreference = "light" | "dark" | "system";

export type ResolvedTheme = "light" | "dark";

const THEME_STORAGE_KEY = "theme";

export function getStoredThemePreference(): ThemePreference {
  if (typeof window === "undefined") {
    return "system";
  }

  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);

    if (stored === "light" || stored === "dark") {
      return stored;
    }
  } catch {
    // Storage can be unavailable (private mode, disabled cookies).
  }

  return "system";
}

export function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") {
    return "light";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  return preference === "system" ? getSystemTheme() : preference;
}

/**
 * Persists the preference ("system" clears the override) and applies the
 * resolved theme to the document. Mirrors the pre-paint bootstrap script in
 * root.tsx — keep the two in sync.
 */
export function applyThemePreference(preference: ThemePreference) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (preference === "system") {
      window.localStorage.removeItem(THEME_STORAGE_KEY);
    } else {
      window.localStorage.setItem(THEME_STORAGE_KEY, preference);
    }
  } catch {
    // The in-page theme still applies even if persistence fails.
  }

  document.documentElement.classList.toggle(
    "dark",
    resolveTheme(preference) === "dark",
  );
}
