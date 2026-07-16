import { describe, expect, it } from "vitest";

import { authRateLimits } from "~/db/schema/auth";

describe("Better Auth rate-limit schema contract", () => {
  it("keeps Better Auth's lastRequest property mapped to last_request", () => {
    expect(authRateLimits.lastRequest.name).toBe("last_request");
    expect("windowStartedAt" in authRateLimits).toBe(false);
  });
});
