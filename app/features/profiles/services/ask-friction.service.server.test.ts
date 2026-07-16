import { describe, expect, it } from "vitest";

import {
  createPublicAskFlashCookieHeader,
  PUBLIC_ASK_FLASH_COOKIE_NAME,
  readPublicAskFlashFromRequest,
} from "~/features/profiles/services/ask-friction.service.server";

describe("public ask error flash", () => {
  it("bounds retained question text so the sealed cookie stays usable", () => {
    const cookieHeader = createPublicAskFlashCookieHeader({
      username: "person",
      result: {
        status: "error",
        formError: "Your question was not sent.",
        values: {
          identityMode: "anonymous",
          question: "x".repeat(5_000),
        },
      },
    });
    const [cookie = ""] = cookieHeader.split(";", 1);
    const request = new Request("https://app.example.test/person", {
      headers: { cookie },
    });

    expect(cookieHeader.length).toBeLessThan(4_096);
    expect(cookie).toContain(`${PUBLIC_ASK_FLASH_COOKIE_NAME}=`);
    expect(readPublicAskFlashFromRequest(request, "person")).toMatchObject({
      status: "error",
      values: {
        identityMode: "anonymous",
        question: "x".repeat(600),
      },
    });
  });
});
