import { createContext } from "react-router";

import type { CurrentSessionSummary } from "~/features/auth/types/auth.types";

export const currentSessionContext = createContext<CurrentSessionSummary>({
  status: "anonymous",
});
