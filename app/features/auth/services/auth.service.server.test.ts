import { describe, expect, it } from "vitest";

import {
  getCompletedProfileGuardRedirectPath,
  type CurrentSessionSummary,
} from "~/features/auth/services/auth.service.server";

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
