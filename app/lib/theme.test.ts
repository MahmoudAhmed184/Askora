import { afterEach, describe, expect, it, vi } from "vitest";

import {
  applyThemePreference,
  getStoredThemePreference,
  resolveTheme,
} from "~/lib/theme";

function mockSystemTheme(theme: "light" | "dark") {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({
      matches: theme === "dark",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  );
}

describe("theme", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.removeItem("theme");
    document.documentElement.classList.remove("dark");
  });

  it("defaults to the system preference when nothing is stored", () => {
    expect(getStoredThemePreference()).toBe("system");
  });

  it("ignores unknown stored values", () => {
    window.localStorage.setItem("theme", "hotdog");

    expect(getStoredThemePreference()).toBe("system");
  });

  it("persists explicit choices and applies the dark class", () => {
    applyThemePreference("dark");

    expect(window.localStorage.getItem("theme")).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    applyThemePreference("light");

    expect(window.localStorage.getItem("theme")).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("clears the override and follows the system for 'system'", () => {
    mockSystemTheme("dark");
    window.localStorage.setItem("theme", "light");

    applyThemePreference("system");

    expect(window.localStorage.getItem("theme")).toBeNull();
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("resolves explicit preferences without touching matchMedia", () => {
    expect(resolveTheme("light")).toBe("light");
    expect(resolveTheme("dark")).toBe("dark");
  });
});
