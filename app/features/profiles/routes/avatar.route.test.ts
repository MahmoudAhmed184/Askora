import { afterEach, describe, expect, it, vi } from "vitest";

import { loader } from "~/features/profiles/routes/avatar.route";

const googleAvatarUrl =
  "https://lh3.googleusercontent.com/a/ACg8ocIVrWHnyKsZGGZrxpIR8fiKduMaw3vKa-cNU7f6XOi4e1jFHcA=s96-c";

describe("avatar proxy route", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects invalid avatar sources", async () => {
    const response = await loader({
      request: new Request("http://localhost/api/avatar?src=https://example.com/a/id"),
    });

    expect(response.status).toBe(400);
  });

  it("proxies allowed image responses", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("img", {
        headers: {
          "Content-Length": "3",
          "Content-Type": "image/png",
        },
      }),
    );

    const response = await loader({
      request: new Request(
        `http://localhost/api/avatar?src=${encodeURIComponent(googleAvatarUrl)}`,
      ),
    });

    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(fetchSpy.mock.calls[0]?.[0]).toBe(googleAvatarUrl);
    expect(fetchSpy.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
    expect(fetchSpy.mock.calls[0]?.[1]?.redirect).toBe("error");
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(response.headers.get("Content-Length")).toBe("3");
    expect(response.headers.get("Cache-Control")).toContain("max-age=86400");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Content-Security-Policy")).toBe(
      "default-src 'none'; sandbox",
    );
    expect(await response.text()).toBe("img");
  });

  it("returns a bad gateway response for non-image upstream responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("not an image", {
        headers: {
          "Content-Type": "text/plain",
        },
      }),
    );

    const response = await loader({
      request: new Request(
        `http://localhost/api/avatar?src=${encodeURIComponent(googleAvatarUrl)}`,
      ),
    });

    expect(response.status).toBe(502);
  });

  it("refuses redirects and SVG responses", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("<svg></svg>", {
        headers: {
          "Content-Type": "image/svg+xml",
        },
      }),
    );

    const response = await loader({
      request: new Request(
        `http://localhost/api/avatar?src=${encodeURIComponent(googleAvatarUrl)}`,
      ),
    });

    expect(response.status).toBe(502);
    expect(fetchSpy.mock.calls[0]?.[1]?.redirect).toBe("error");
  });

  it("rejects oversized upstream bodies", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("x".repeat(5 * 1024 * 1024 + 1), {
        headers: {
          "Content-Type": "image/png",
        },
      }),
    );

    const response = await loader({
      request: new Request(
        `http://localhost/api/avatar?src=${encodeURIComponent(googleAvatarUrl)}`,
      ),
    });

    expect(response.status).toBe(502);
  });
});
