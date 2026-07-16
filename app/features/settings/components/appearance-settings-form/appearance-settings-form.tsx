import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { useState, useSyncExternalStore } from "react";

import {
  applyThemePreference,
  getStoredThemePreference,
  type ThemePreference,
} from "~/lib/theme";
import { cn } from "~/lib/utils";

const themeOptions = [
  {
    value: "light",
    label: "Light",
    description: "Bright surfaces with dark text.",
    icon: Sun,
  },
  {
    value: "dark",
    label: "Dark",
    description: "Dimmed surfaces with light text.",
    icon: Moon,
  },
  {
    value: "system",
    label: "System",
    description: "Follows your device setting automatically.",
    icon: Monitor,
  },
] as const satisfies readonly {
  value: ThemePreference;
  label: string;
  description: string;
  icon: LucideIcon;
}[];

export function AppearanceSettingsForm() {
  const mounted = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot,
  );
  const [preference, setPreference] = useState<ThemePreference | undefined>(
    undefined,
  );
  const activePreference =
    preference ?? (mounted ? getStoredThemePreference() : undefined);
  const activeOption = themeOptions.find(
    (option) => option.value === activePreference,
  );

  return (
    <div className="flex flex-col gap-5 p-5 sm:p-7">
      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium leading-none">Theme</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {themeOptions.map((option) => {
            const Icon = option.icon;
            const isSelected = option.value === activePreference;

            return (
              <label
                className={cn(
                  "inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm font-bold transition-[background-color,border-color,color,box-shadow] has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/30",
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground shadow-[0_4px_12px_var(--accent-glow)]"
                    : "bg-card text-foreground hover:border-primary/40",
                  !mounted && "cursor-default opacity-60",
                )}
                key={option.value}
              >
                <input
                  checked={isSelected}
                  className="sr-only"
                  disabled={!mounted}
                  name="themePreference"
                  onChange={() => {
                    setPreference(option.value);
                    applyThemePreference(option.value);
                  }}
                  type="radio"
                  value={option.value}
                />
                <Icon aria-hidden="true" className="size-4" />
                {option.label}
              </label>
            );
          })}
        </div>
        <p
          aria-live="polite"
          className="min-h-6 text-sm leading-6 text-muted-foreground"
        >
          {activeOption?.description ?? ""}
        </p>
      </fieldset>
      <p className="border-t pt-4 text-sm leading-6 text-muted-foreground">
        The theme is saved on this device and applies before you sign in too.
        Other devices keep their own setting.
      </p>
    </div>
  );
}

function subscribe() {
  return unsubscribe;
}

function unsubscribe() {
  return undefined;
}

function getClientSnapshot() {
  return true;
}

function getServerSnapshot() {
  return false;
}
