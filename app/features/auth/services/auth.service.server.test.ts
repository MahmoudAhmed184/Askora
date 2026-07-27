import { afterEach, describe, expect, it, vi } from "vitest";

import {
  auth,
  getBetterAuthSessionWithHeaders,
  getCompletedProfileGuardRedirectPath,
  type CurrentSessionSummary,
} from "~/features/auth/services/auth.service.server";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("session cookie cache", () => {
  it("requests an authoritative session and exposes Better Auth response cookies", async () => {
    const request = new Request("https://app.example.test/settings/account", {
      headers: { Cookie: "better-auth.session_token=signed-token" },
    });
    const getSession = vi
      .spyOn(auth.api, "getSession")
      .mockResolvedValue({
        headers: new Headers({
          "Set-Cookie": "better-auth.session_data=signed-cache; Path=/; HttpOnly",
        }),
        response: null,
      } as never);

    const result = await getBetterAuthSessionWithHeaders(request, {
      disableCookieCache: true,
    });

    expect(getSession).toHaveBeenCalledWith({
      headers: request.headers,
      query: { disableCookieCache: true },
      returnHeaders: true,
    });
    expect(result.response).toBeNull();
    expect(result.headers.get("Set-Cookie")).toContain(
      "better-auth.session_data=signed-cache",
    );
  });
});

describe("completed profile session guards", () => {
  it("redirects deactivated profiles to recoverable account settings", () => {
    expect(
      getCompletedProfileGuardRedirectPath({
        ...completedSession,
        profileActive: false,
      }),
    ).toBe("/settings/account");
  });

  it("keeps active profiles on authenticated routes", () => {
    expect(getCompletedProfileGuardRedirectPath(completedSession)).toBeUndefined();
  });

  it("redirects suspended profiles to the recoverable account surface", () => {
    expect(
      getCompletedProfileGuardRedirectPath({
        ...completedSession,
        suspensionStatus: "active",
      }),
    ).toBe("/settings/account");
  });
});

const completedSession = {
  status: "authenticated",
  profileStatus: "complete",
  suspensionStatus: "none",
  user: {
    id: "user_1",
    email: "person@example.com",
    name: "Person",
    image: undefined,
  },
  profile: {
    id: "profile_1",
    username: "person",
    displayName: "Person",
    avatarUrl: null,
  },
} satisfies Extract<CurrentSessionSummary, { status: "authenticated" }>;
