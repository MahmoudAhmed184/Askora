import { AlertCircle, CheckCircle2, Info, LoaderCircle } from "lucide-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

import { cn } from "~/lib/utils";

const toastIcons: ToasterProps["icons"] = {
  error: <AlertCircle aria-hidden="true" size={18} strokeWidth={2.5} />,
  info: <Info aria-hidden="true" size={18} strokeWidth={2.5} />,
  loading: (
    <LoaderCircle
      aria-hidden="true"
      className="app-toast-loading"
      size={18}
      strokeWidth={2.5}
    />
  ),
  success: <CheckCircle2 aria-hidden="true" size={18} strokeWidth={2.5} />,
  warning: <AlertCircle aria-hidden="true" size={18} strokeWidth={2.5} />,
};

const toastClassNames: NonNullable<
  NonNullable<ToasterProps["toastOptions"]>["classNames"]
> = {
  actionButton: "app-toast-action",
  cancelButton: "app-toast-cancel",
  content: "app-toast-content",
  description: "app-toast-description",
  icon: "app-toast-icon",
  title: "app-toast-title",
  toast: "app-toast",
};

function Toaster({
  className,
  duration = 2600,
  gap = 10,
  icons,
  mobileOffset = { bottom: "100px", left: "16px", right: "16px" },
  offset = { bottom: "100px" },
  position = "bottom-center",
  richColors = false,
  swipeDirections = ["bottom", "left", "right"],
  theme = "dark",
  toastOptions,
  ...props
}: ToasterProps) {
  return (
    <Sonner
      className={cn("toaster group", className)}
      duration={duration}
      gap={gap}
      icons={{ ...toastIcons, ...icons }}
      mobileOffset={mobileOffset}
      offset={offset}
      position={position}
      richColors={richColors}
      swipeDirections={swipeDirections}
      theme={theme}
      toastOptions={{
        ...toastOptions,
        classNames: {
          ...toastClassNames,
          ...toastOptions?.classNames,
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
