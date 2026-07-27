export const appShellRouteHandle = {
  usesAppShell: true,
} as const;

export function usesAppShell(
  handle: unknown,
): handle is typeof appShellRouteHandle {
  return (
    typeof handle === "object" &&
    handle !== null &&
    "usesAppShell" in handle &&
    handle.usesAppShell === true
  );
}
