import { useId } from "react";

import { Switch } from "~/components/ui/switch/switch";

interface SettingsSwitchFieldProps {
  checked: boolean;
  description: string;
  disabled?: boolean | undefined;
  label: string;
  name: string;
  onChange: (checked: boolean) => void;
}

export function SettingsSwitchField({
  checked,
  description,
  disabled,
  label,
  name,
  onChange,
}: SettingsSwitchFieldProps) {
  const labelId = useId();
  const descriptionId = useId();

  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border bg-secondary p-3">
      <span className="flex min-w-0 flex-col">
        <span className="text-sm font-medium" id={labelId}>
          {label}
        </span>
        <span
          className="mt-1 block text-sm leading-6 text-muted-foreground"
          id={descriptionId}
        >
          {description}
        </span>
      </span>
      <Switch
        aria-describedby={descriptionId}
        aria-labelledby={labelId}
        checked={checked}
        className="mt-0.5 shrink-0"
        disabled={disabled}
        onCheckedChange={onChange}
      />
      <input name={name} type="hidden" value={checked ? "true" : "false"} />
    </div>
  );
}
