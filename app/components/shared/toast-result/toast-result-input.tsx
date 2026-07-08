import { useSyncExternalStore } from "react";

import {
  TOAST_RESULT_FIELD_NAME,
  TOAST_RESULT_FIELD_VALUE,
} from "~/components/shared/toast-result/toast-result";

export function ToastResultInput() {
  const mounted = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot,
  );

  if (!mounted) {
    return null;
  }

  return (
    <input
      name={TOAST_RESULT_FIELD_NAME}
      type="hidden"
      value={TOAST_RESULT_FIELD_VALUE}
    />
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
