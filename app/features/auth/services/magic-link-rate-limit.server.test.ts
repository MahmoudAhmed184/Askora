import { describe, expect, it } from "vitest";

import { checkMagicLinkRateLimit } from "~/features/auth/services/magic-link-rate-limit.server";
import type { RateLimitOptions } from "~/lib/rate-limit.server";

describe("magic-link rate limiting", () => {
  it("enforces hourly and daily email limits before the IP limit", async () => {
    const checks: RateLimitOptions[] = [];

    const decision = await checkMagicLinkRateLimit({
      email: "Person@Example.com",
      request: new Request("https://app.example.test/login"),
      rateLimit: (options) => {
        checks.push(options);
        return Promise.resolve({ allowed: true });
      },
    });

    expect(decision).toEqual({ allowed: true });
    expect(checks).toHaveLength(3);
    expect(checks[0]).toMatchObject({ max: 5, windowSeconds: 3_600 });
    expect(checks[1]).toMatchObject({ max: 10, windowSeconds: 86_400 });
    expect(checks[1]?.key).toContain(":daily");
    expect(checks[2]).toMatchObject({ max: 20, windowSeconds: 3_600 });
  });
});
