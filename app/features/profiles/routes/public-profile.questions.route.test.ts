import { describe, expect, it } from "vitest";

import { loader } from "~/features/profiles/routes/public-profile.questions.route";

describe("public profile questions route", () => {
  it("redirects GET requests back to the ask box", () => {
    const response = loader({
      params: {
        username: "mahmoudbahnasawy820",
      },
      request: new Request(
        "https://app.example.com/mahmoudbahnasawy820/questions",
      ),
    } as Parameters<typeof loader>[0]);

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/mahmoudbahnasawy820#ask");
  });
});
