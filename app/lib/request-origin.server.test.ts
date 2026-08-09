import { describe, expect, it } from "vitest";

import { requireTrustedMutationOrigin } from "~/lib/request-origin.server";

describe("requireTrustedMutationOrigin", () => {
  it("rejects an untrusted browser origin", () => {
    const response = requireTrustedMutationOrigin(
      new Request("http://localhost:5173/settings/question-generation", {
        method: "POST",
        headers: { Origin: "https://attacker.example" },
      }),
    );

    expect(response?.status).toBe(403);
  });

  it("accepts the configured app origin and native requests without browser metadata", () => {
    expect(
      requireTrustedMutationOrigin(
        new Request("http://localhost:5173/settings/question-generation", {
          method: "POST",
          headers: { Origin: "http://localhost:5173" },
        }),
      ),
    ).toBeUndefined();
    expect(
      requireTrustedMutationOrigin(
        new Request("http://localhost:5173/settings/question-generation", {
          method: "POST",
        }),
      ),
    ).toBeUndefined();
  });

  it("checks Referer when Origin is absent", () => {
    const response = requireTrustedMutationOrigin(
      new Request("http://localhost:5173/inbox", {
        method: "POST",
        headers: { Referer: "https://attacker.example/inbox" },
      }),
    );

    expect(response?.status).toBe(403);
  });
});
