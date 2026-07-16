import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppearanceSettingsForm } from "~/features/settings/components/appearance-settings-form";

describe("AppearanceSettingsForm", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.removeItem("theme");
    document.documentElement.classList.remove("dark");
  });

  it("offers light, dark, and system options", () => {
    mockSystemTheme("light");
    render(<AppearanceSettingsForm />);

    expect(screen.getByRole("radio", { name: /light/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /dark/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /system/i })).toBeInTheDocument();
  });

  it("applies and persists an explicit dark choice", () => {
    mockSystemTheme("light");
    render(<AppearanceSettingsForm />);

    fireEvent.click(screen.getByRole("radio", { name: /dark/i }));

    expect(window.localStorage.getItem("theme")).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("clears the override when returning to system", () => {
    mockSystemTheme("light");
    window.localStorage.setItem("theme", "dark");
    document.documentElement.classList.add("dark");
    render(<AppearanceSettingsForm />);

    fireEvent.click(screen.getByRole("radio", { name: /system/i }));

    expect(window.localStorage.getItem("theme")).toBeNull();
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});

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
