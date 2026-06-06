import { AlertCircle, CheckCircle2 } from "lucide-react";

import { cn } from "../../lib/utils";

type GeminiNotificationProps = {
  message: string;
  open: boolean;
  tone?: "danger" | "success";
};

export function GeminiNotification({
  message,
  open,
  tone = "success",
}: GeminiNotificationProps) {
  const Icon = tone === "danger" ? AlertCircle : CheckCircle2;

  return (
    <div
      aria-live="polite"
      className={cn("gemini-toast-notification", open && "show")}
      role="status"
    >
      <div className={cn("gemini-toast-icon", tone === "danger" && "danger")}>
        <Icon aria-hidden="true" size={18} strokeWidth={2.5} />
      </div>
      <div>{message}</div>
    </div>
  );
}
