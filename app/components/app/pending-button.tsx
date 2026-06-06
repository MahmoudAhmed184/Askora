import * as React from "react";
import { LoaderCircle } from "lucide-react";
import { useNavigation } from "react-router";

import { Button } from "~/components/ui/button";

interface PendingButtonProps extends React.ComponentProps<typeof Button> {
  pendingName?: string;
  pendingText?: string;
  pendingValue?: string;
}

export function PendingButton({
  children,
  disabled,
  pendingName,
  pendingText = "Working",
  pendingValue,
  ...props
}: PendingButtonProps) {
  const navigation = useNavigation();
  const isPending = isButtonSubmissionPending({
    formData: navigation.formData,
    name: pendingName ?? getStringProp(props.name),
    state: navigation.state,
    value: pendingValue ?? getStringProp(props.value),
  });

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

function isButtonSubmissionPending({
  formData,
  name,
  state,
  value,
}: {
  formData: FormData | undefined;
  name: string | undefined;
  state: ReturnType<typeof useNavigation>["state"];
  value: string | undefined;
}) {
  if (state !== "submitting") {
    return false;
  }

  if (name === undefined) {
    return true;
  }

  if (!formData?.has(name)) {
    return false;
  }

  if (value === undefined) {
    return true;
  }

  return formData.getAll(name).some((entry) => entry === value);
}

function getStringProp(value: unknown) {
  return typeof value === "string" ? value : undefined;
}
