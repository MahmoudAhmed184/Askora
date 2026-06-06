import * as React from "react";

export type ToastState = {
  message: string;
  tone: "danger" | "success";
};

export function usePrototypeToast(delay = 2600) {
  const [toast, setToast] = React.useState<ToastState | null>(null);

  React.useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setToast(null);
    }, delay);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [delay, toast]);

  function triggerToast(
    message: string,
    tone: ToastState["tone"] = "success",
  ) {
    setToast({ message, tone });
  }

  return { toast, triggerToast };
}
