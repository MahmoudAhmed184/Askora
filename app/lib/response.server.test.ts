import { describe, expect, it } from "vitest";

import { createDocumentHeaders, mergeNoindexHeaders } from "~/lib/response.server";

describe("response headers", () => {
  it("prevents shared caching for authenticated documents", () => {
    const headers = createDocumentHeaders({
      hasCookie: true,
      isAuthenticated: true,
    });

    expect(headers.get("Cache-Control")).toBe("private, no-store");
    expect(headers.get("Vary")).toBe("Cookie");
  });

  it("prevents shared caching when anonymous requests still carry cookies", () => {
    const headers = createDocumentHeaders({
      hasCookie: true,
      isAuthenticated: false,
    });

    expect(headers.get("Cache-Control")).toBe("private, no-store");
    expect(headers.get("Vary")).toBe("Cookie");
  });

  it("allows short public caching for anonymous cookieless documents", () => {
    const headers = createDocumentHeaders({
      hasCookie: false,
      isAuthenticated: false,
    });

    expect(headers.get("Cache-Control")).toBe(
      "public, max-age=30, stale-while-revalidate=120",
    );
    expect(headers.get("Vary")).toBe("Cookie");
  });

  it("adds beta noindex headers without dropping cache headers", () => {
    const headers = mergeNoindexHeaders(
      createDocumentHeaders({
        hasCookie: false,
        isAuthenticated: false,
      }),
      true,
    );

    expect(headers.get("Cache-Control")).toBe(
      "public, max-age=30, stale-while-revalidate=120",
    );
    expect(headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
    expect(headers.get("Vary")).toBe("Cookie");
  });
});
