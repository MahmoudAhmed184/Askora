import { describe, expect, it, vi } from "vitest";

import { handleError } from "~/entry.server";

describe("server error handling", () => {
  it("writes structured request context without logging aborted requests", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const request = new Request("https://app.example.test/inbox", {
      headers: { "User-Agent": "test-browser" },
    });

    handleError(new Error("database unavailable"), { request });

    expect(errorSpy).toHaveBeenCalledOnce();
    const calls = errorSpy.mock.calls as unknown[][];
    const payload: unknown = calls[0]?.[0];
    const record = JSON.parse(String(payload)) as Record<string, unknown>;

    expect(record).toMatchObject({
      event: "request_error",
      method: "GET",
      url: "https://app.example.test/inbox",
      userAgent: "test-browser",
      error: {
        name: "Error",
        message: "database unavailable",
      },
    });
    expect(record.errorId).toEqual(expect.any(String));

    errorSpy.mockClear();
    const controller = new AbortController();
    controller.abort();
    handleError(new Error("request aborted"), {
      request: new Request("https://app.example.test/inbox", {
        signal: controller.signal,
      }),
    });

    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
