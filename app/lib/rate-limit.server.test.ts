import { beforeEach, describe, expect, it } from "vitest";

import { checkRateLimit, clearMemoryRateLimits } from "~/lib/rate-limit.server";

describe("checkRateLimit", () => {
  beforeEach(() => {
    clearMemoryRateLimits();
  });

  it("blocks after the configured threshold", async () => {
    const options = {
      key: "test:magic-link:email",
      max: 2,
      storage: "memory" as const,
      windowSeconds: 60,
      now: () => 1_000,
    };

    await expect(checkRateLimit(options)).resolves.toEqual({ allowed: true });
    await expect(checkRateLimit(options)).resolves.toEqual({ allowed: true });
    await expect(checkRateLimit(options)).resolves.toEqual({
      allowed: false,
      retryAfterSeconds: 60,
    });
  });

  it("allows requests after the window resets", async () => {
    let now = 1_000;
    const options = {
      key: "test:reset",
      max: 1,
      storage: "memory" as const,
      windowSeconds: 60,
      now: () => now,
    };

    await checkRateLimit(options);
    now = 62_000;

    await expect(checkRateLimit(options)).resolves.toEqual({ allowed: true });
  });
});
