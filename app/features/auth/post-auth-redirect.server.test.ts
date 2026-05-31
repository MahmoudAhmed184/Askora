import { describe, expect, it } from "vitest";

import {
  getCompletedProfileGuardRedirectPath,
  getIncompleteProfileGuardRedirectPath,
  toPublicSessionSummary,
  type CompletedProfileSessionSummary,
  type CurrentSessionSummary,
  type IncompleteProfileSessionSummary,
} from "~/features/auth/auth.server";
import { getPostAuthRedirectPath } from "~/features/auth/post-auth-redirect.server";

describe("post-auth redirects", () => {
  it("sends callback URLs through login until the session exists", () => {
    expect(getPostAuthRedirectPath()).toBe("/login");
  });

  it("sends incomplete-profile users to setup", () => {
    expect(getPostAuthRedirectPath(createIncompleteSession())).toBe("/setup");
  });

  it("sends completed-profile users to the temporary share destination", () => {
    expect(getPostAuthRedirectPath(createCompletedSession())).toBe("/setup/share");
  });
});

describe("profile guard redirect decisions", () => {
  it("redirects setup-route anonymous users to login", () => {
    expect(getIncompleteProfileGuardRedirectPath(anonymousSession)).toBe("/login");
  });

  it("redirects setup-route completed profiles to share", () => {
    expect(getIncompleteProfileGuardRedirectPath(createCompletedSession())).toBe(
      "/setup/share",
    );
  });

  it("allows setup-route incomplete profiles", () => {
    expect(
      getIncompleteProfileGuardRedirectPath(createIncompleteSession()),
    ).toBeUndefined();
  });

  it("redirects share-route anonymous users to login", () => {
    expect(getCompletedProfileGuardRedirectPath(anonymousSession)).toBe("/login");
  });

  it("redirects share-route incomplete profiles to setup", () => {
    expect(getCompletedProfileGuardRedirectPath(createIncompleteSession())).toBe(
      "/setup",
    );
  });

  it("allows share-route completed profiles", () => {
    expect(
      getCompletedProfileGuardRedirectPath(createCompletedSession()),
    ).toBeUndefined();
  });
});

describe("public session summary", () => {
  it("does not serialize private account details globally", () => {
    const publicSummary = toPublicSessionSummary(createCompletedSession());

    expect(JSON.stringify(publicSummary)).not.toContain("person@example.com");
    expect(JSON.stringify(publicSummary)).not.toContain("user_1");
    expect(publicSummary).toEqual({
      status: "authenticated",
      profileStatus: "complete",
      suspensionStatus: "none",
      profile: {
        username: "person",
        displayName: "Person",
      },
    });
  });
});

const anonymousSession = {
  status: "anonymous",
} satisfies CurrentSessionSummary;

function createIncompleteSession(): IncompleteProfileSessionSummary {
  return {
    status: "authenticated",
    profileStatus: "incomplete",
    suspensionStatus: "none",
    user: {
      id: "user_1",
      email: "person@example.com",
      name: "Person",
      image: undefined,
    },
  };
}

function createCompletedSession(): CompletedProfileSessionSummary {
  return {
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
  };
}
