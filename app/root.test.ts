import { describe, expect, it } from "vitest";

import { shouldRevalidate } from "~/root";
import {
  shouldBypassSessionCookieCache,
  withSessionCookieHeaders,
} from "~/features/auth/services/auth.service.server";

describe("root session middleware", () => {
  it.each([
    "/admin",
    "/admin/reports/report_1",
    "/settings/account",
  ])("forces an authoritative session read for %s", (pathname) => {
    expect(shouldBypassSessionCookieCache(pathname)).toBe(true);
  });

  it.each(["/feed", "/inbox", "/settings/profile", "/administrator"])(
    "allows the short cookie cache for %s",
    (pathname) => {
      expect(shouldBypassSessionCookieCache(pathname)).toBe(false);
    },
  );

  it("forwards Better Auth's cache cookie without replacing route headers", () => {
    const response = withSessionCookieHeaders(
      new Response("ok", {
        headers: { "X-Route": "preserved" },
      }),
      new Headers({
        "Set-Cookie": "better-auth.session_data=signed-cache; Path=/; HttpOnly",
      }),
    );

    expect(response.headers.get("X-Route")).toBe("preserved");
    expect(response.headers.get("Set-Cookie")).toContain(
      "better-auth.session_data=signed-cache",
    );
  });
});

describe("root revalidation", () => {
  it("skips the root loader for ordinary pathname navigation", () => {
    expect(shouldRevalidateBetween("/feed", "/inbox")).toBe(false);
  });

  it("revalidates the root loader after mutations", () => {
    expect(
      shouldRevalidateBetween("/inbox", "/notifications", {
        formMethod: "POST",
      }),
    ).toBe(true);
  });

  it("revalidates the root loader across authentication boundaries", () => {
    expect(shouldRevalidateBetween("/login", "/feed")).toBe(true);
  });

  it("revalidates the root loader when answer modal parameters change", () => {
    expect(
      shouldRevalidateBetween(
        "/inbox",
        "/inbox?answerQuestionId=question-public-id",
      ),
    ).toBe(true);
  });

  it("revalidates the root loader when thread modal parameters change", () => {
    expect(
      shouldRevalidateBetween(
        "/feed",
        "/feed?threadUsername=person&threadPublicId=thread-public-id",
      ),
    ).toBe(true);
  });

  it("keeps React Router's default for same-path revalidation", () => {
    expect(
      shouldRevalidateBetween("/feed", "/feed", {
        defaultShouldRevalidate: false,
      }),
    ).toBe(false);
  });
});

function shouldRevalidateBetween(
  currentPath: string,
  nextPath: string,
  overrides: Partial<Parameters<typeof shouldRevalidate>[0]> = {},
) {
  return shouldRevalidate({
    currentParams: {},
    currentUrl: new URL(currentPath, "https://app.example.test"),
    defaultShouldRevalidate: true,
    nextParams: {},
    nextUrl: new URL(nextPath, "https://app.example.test"),
    ...overrides,
  });
}
