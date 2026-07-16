import { describe, expect, it } from "vitest";

import { parseServerEnv } from "~/lib/env.server";

describe("parseServerEnv", () => {
  it("provides local development defaults without secrets", () => {
    const environment = parseServerEnv({});

    expect(environment.APP_NAME).toBe("Askora");
    expect(environment.APP_URL).toBe("http://localhost:5173");
    expect(environment.PUBLIC_BETA_NOINDEX).toBe(true);
    expect(environment.BETTER_AUTH_URL).toBe("http://localhost:5173");
  });

  it("parses false boolean strings", () => {
    const environment = parseServerEnv({
      PUBLIC_BETA_NOINDEX: "false",
    });

    expect(environment.PUBLIC_BETA_NOINDEX).toBe(false);
  });

  it("deduplicates trusted origins with the app and auth URLs", () => {
    const environment = parseServerEnv({
      APP_URL: "https://app.example.com",
      BETTER_AUTH_URL: "https://auth.example.com",
      TRUSTED_ORIGINS:
        "https://app.example.com,https://preview.example.com",
    });

    expect(environment.TRUSTED_ORIGINS).toEqual([
      "https://app.example.com",
      "https://auth.example.com",
      "https://preview.example.com",
    ]);
  });

  it("requires runtime database and auth secret in production", () => {
    expect(() =>
      parseServerEnv({
        NODE_ENV: "production",
      }),
    ).toThrow(/DATABASE_URL/);
  });

  it("requires production auth providers and email delivery", () => {
    expect(() =>
      parseServerEnv({
        NODE_ENV: "production",
        DATABASE_URL: "postgres://user:password@example.com:5432/app",
        BETTER_AUTH_SECRET: "x".repeat(32),
      }),
    ).toThrow(/GOOGLE_CLIENT_ID/);
  });
});
