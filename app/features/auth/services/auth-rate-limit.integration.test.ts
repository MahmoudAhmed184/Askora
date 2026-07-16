import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { getRuntimeDatabase } from "~/db/client.server";
import { authRateLimits } from "~/db/schema";
import { auth } from "~/features/auth/services/auth.service.server";
import { serverEnv } from "~/lib/env.server";

const describeDatabase =
  serverEnv.DATABASE_URL === undefined ? describe.skip : describe;

describeDatabase("Better Auth database rate limiting", () => {
  it("writes get-session requests using the trusted proxy address", async () => {
    const ipAddress = `198.51.100.${String(Math.floor(Math.random() * 200) + 1)}`;
    const key = `${ipAddress}|/get-session`;
    const database = getRuntimeDatabase();

    await database.delete(authRateLimits).where(eq(authRateLimits.key, key));

    try {
      const response = await auth.handler(
        new Request("http://localhost/api/auth/get-session", {
          headers: {
            [serverEnv.TRUSTED_PROXY_IP_HEADER]: ipAddress,
          },
        }),
      );

      expect(response.status).toBe(200);
      const [row] = await database
        .select({ key: authRateLimits.key, lastRequest: authRateLimits.lastRequest })
        .from(authRateLimits)
        .where(eq(authRateLimits.key, key))
        .limit(1);

      expect(row?.key).toBe(key);
      expect(row?.lastRequest).toBeTypeOf("number");
    } finally {
      await database.delete(authRateLimits).where(eq(authRateLimits.key, key));
    }
  });
});
