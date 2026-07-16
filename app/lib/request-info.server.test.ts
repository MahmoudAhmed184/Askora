import { describe, expect, it } from "vitest";

import { getClientIpAddress } from "~/lib/request-info.server";

describe("getClientIpAddress", () => {
  it("prefers the configured proxy header over a client-controlled XFF value", () => {
    const request = new Request("https://app.example.com", {
      headers: {
        "x-vercel-forwarded-for": "198.51.100.8",
        "x-forwarded-for": "203.0.113.99, 198.51.100.8",
      },
    });

    expect(getClientIpAddress(request)).toBe("198.51.100.8");
  });

  it("uses the untrusted hop before the configured proxy chain", () => {
    const request = new Request("https://app.example.com", {
      headers: {
        "x-forwarded-for":
          "198.51.100.8, 192.0.2.10, 192.0.2.11",
      },
    });

    expect(getClientIpAddress(request)).toBe("192.0.2.10");
  });
});
