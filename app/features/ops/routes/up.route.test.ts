import { describe, expect, it } from "vitest";

import { loader } from "~/features/ops/routes/up.route";

describe("readiness route", () => {
  it("returns ok only after the database check succeeds", async () => {
    const response = await loader(
      { request: new Request("https://app.example.test/up") },
      () => Promise.resolve(),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });

  it("returns service unavailable without exposing the database error", async () => {
    const response = await loader(
      { request: new Request("https://app.example.test/up") },
      () => Promise.reject(new Error("secret connection detail")),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ status: "unavailable" });
  });
});
