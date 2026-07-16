import { describe, expect, it } from "vitest";

import { checkInviteValidationRateLimit } from "~/features/auth/services/invite-validation-rate-limit.server";
import type { RateLimitOptions } from "~/lib/rate-limit.server";

describe("invite validation rate limiting", () => {
  it("limits supplied invite codes by authoritative client IP", async () => {
    const checks: RateLimitOptions[] = [];
    const decision = await checkInviteValidationRateLimit({
      inviteCode: "BETA-ACCESS",
      request: new Request("https://app.example.test/login", {
        headers: { "x-vercel-forwarded-for": "203.0.113.10" },
      }),
      rateLimit: (options) => {
        checks.push(options);
        return Promise.resolve({ allowed: true });
      },
    });

    expect(decision).toEqual({ allowed: true });
    expect(checks).toHaveLength(1);
    expect(checks[0]).toMatchObject({ max: 20, windowSeconds: 900 });
    expect(checks[0]?.key).toMatch(/^invite-validation:ip:/);
  });

  it("does not spend validity-oracle limits when no invite is supplied", async () => {
    let checked = false;
    const decision = await checkInviteValidationRateLimit({
      inviteCode: undefined,
      request: new Request("https://app.example.test/login"),
      rateLimit: () => {
        checked = true;
        return Promise.resolve({ allowed: true });
      },
    });

    expect(decision).toEqual({ allowed: true });
    expect(checked).toBe(false);
  });
});
