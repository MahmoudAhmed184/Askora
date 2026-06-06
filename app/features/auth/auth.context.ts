import { createContext } from "react-router";

import type { CurrentSessionSummary } from "~/features/auth/auth.server";

export const currentSessionContext = createContext<CurrentSessionSummary>({
  status: "anonymous",
});
