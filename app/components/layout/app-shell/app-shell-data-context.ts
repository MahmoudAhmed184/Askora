import { createContext, useContext } from "react";

import type { AppShellData } from "~/types/app-shell-data";

export const AppShellDataContext = createContext<AppShellData | undefined>(
  undefined,
);

export function useAppShellData() {
  return useContext(AppShellDataContext);
}
