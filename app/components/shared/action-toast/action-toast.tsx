import { useEffect } from "react";
import { toast, type ExternalToast } from "sonner";

export type ActionToastTone = "error" | "info" | "success" | "warning";

interface ActionToastProps {
  description?: string | undefined;
  message: string | undefined;
  tone: ActionToastTone;
  trigger?: unknown;
}

export function ActionToast({
  description,
  message,
  tone,
  trigger,
}: ActionToastProps) {
  useEffect(() => {
    if (message === undefined) {
      return;
    }

    showToast(tone, message, description);
  }, [description, message, tone, trigger]);

  return null;
}

function showToast(
  tone: ActionToastTone,
  message: string,
  description: string | undefined,
) {
  const options: ExternalToast = {
    id: getActionToastId({ description, message, tone }),
  };

  if (description !== undefined) {
    options.description = description;
  }

  if (tone === "success") {
    toast.success(message, options);
    return;
  }

  if (tone === "warning") {
    toast.warning(message, options);
    return;
  }

  if (tone === "info") {
    toast.info(message, options);
    return;
  }

  toast.error(message, options);
}

function getActionToastId({
  description,
  message,
  tone,
}: {
  description: string | undefined;
  message: string;
  tone: ActionToastTone;
}) {
  return `action-toast:${tone}:${message}:${description ?? ""}`;
}
