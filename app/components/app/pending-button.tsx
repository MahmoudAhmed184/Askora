import * as React from "react";
import { LoaderCircle } from "lucide-react";
import { useNavigation } from "react-router";

import { Button } from "~/components/ui/button";

interface PendingButtonProps extends React.ComponentProps<typeof Button> {
  pendingText?: string;
}

export function PendingButton({
  children,
  disabled,
  pendingText = "Working",
  ...props
}: PendingButtonProps) {
  const navigation = useNavigation();
  const isPending = navigation.state !== "idle";

  return (
    <Button disabled={disabled === true || isPending} {...props}>
      {isPending ? (
        <>
          <LoaderCircle data-icon="inline-start" className="animate-spin" />
          {pendingText}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
