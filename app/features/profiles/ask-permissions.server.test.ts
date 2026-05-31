import { describe, expect, it } from "vitest";

import type {
  CurrentSessionSummary,
} from "~/features/auth/auth.server";
import {
  evaluateAskPermission,
  getPublicAskState,
  type AskPermissionTarget,
} from "~/features/profiles/ask-permissions.server";

describe("evaluateAskPermission", () => {
  it("allows guest anonymous asks when everyone and anonymous are enabled", () => {
    expect(
      evaluateAskPermission({
        actor: anonymousSession,
        identity: "anonymous",
        target: createTarget(),
      }),
    ).toEqual({
      status: "allowed",
      identityMode: "guest_anonymous",
    });
  });

  it("denies guest anonymous asks when anonymous is disabled", () => {
    expect(
      evaluateAskPermission({
        actor: anonymousSession,
        identity: "anonymous",
        target: createTarget({ anonymousQuestionsEnabled: false }),
      }),
    ).toMatchObject({
      status: "denied",
      reason: "anonymous_disabled",
    });
  });

  it("allows logged-in complete users to ask attributed or anonymous when allowed", () => {
    expect(
      evaluateAskPermission({
        actor: completedSession,
        identity: "attributed",
        target: createTarget({ askPermission: "logged_in" }),
      }),
    ).toEqual({
      status: "allowed",
      identityMode: "account_attributed",
    });

    expect(
      evaluateAskPermission({
        actor: completedSession,
        identity: "anonymous",
        target: createTarget({ askPermission: "logged_in" }),
      }),
    ).toEqual({
      status: "allowed",
      identityMode: "account_anonymous",
    });
  });

  it("limits incomplete users to anonymous asks", () => {
    expect(
      evaluateAskPermission({
        actor: incompleteSession,
        identity: "anonymous",
        target: createTarget(),
      }),
    ).toMatchObject({
      status: "allowed",
      identityMode: "account_anonymous",
    });

    expect(
      evaluateAskPermission({
        actor: incompleteSession,
        identity: "attributed",
        target: createTarget(),
      }),
    ).toMatchObject({
      status: "denied",
      reason: "profile_required",
    });
  });

  it("conservatively denies followers-only asks until follows exist", () => {
    expect(
      evaluateAskPermission({
        actor: completedSession,
        identity: "attributed",
        target: createTarget({ askPermission: "followers" }),
      }),
    ).toMatchObject({
      status: "denied",
      reason: "followers_only",
    });
  });

  it("denies off, inactive, closed, and suspended cases", () => {
    expect(
      evaluateAskPermission({
        actor: completedSession,
        identity: "attributed",
        target: createTarget({ askPermission: "off" }),
      }),
    ).toMatchObject({ status: "denied", reason: "permission_off" });

    expect(
      evaluateAskPermission({
        actor: completedSession,
        identity: "attributed",
        target: createTarget({ isActive: false }),
      }),
    ).toMatchObject({ status: "denied", reason: "profile_inactive" });

    expect(
      evaluateAskPermission({
        actor: completedSession,
        identity: "attributed",
        target: createTarget({ acceptingQuestions: false }),
      }),
    ).toMatchObject({ status: "denied", reason: "questions_closed" });

    expect(
      evaluateAskPermission({
        actor: { ...completedSession, suspensionStatus: "active" },
        identity: "attributed",
        target: createTarget(),
      }),
    ).toMatchObject({ status: "denied", reason: "suspended" });
  });
});

describe("getPublicAskState", () => {
  it("summarizes denied guest logged-in-only state", () => {
    expect(
      getPublicAskState({
        actor: anonymousSession,
        target: createTarget({ askPermission: "logged_in" }),
      }),
    ).toMatchObject({
      status: "denied",
      reason: "login_required",
      action: {
        href: "/login",
      },
    });
  });
});

function createTarget(
  overrides: Partial<AskPermissionTarget> = {},
): AskPermissionTarget {
  return {
    isActive: true,
    acceptingQuestions: true,
    anonymousQuestionsEnabled: true,
    askPermission: "everyone",
    ...overrides,
  };
}

const anonymousSession = {
  status: "anonymous",
} satisfies CurrentSessionSummary;

const incompleteSession = {
  status: "authenticated",
  profileStatus: "incomplete",
  suspensionStatus: "none",
  user: {
    id: "user_2",
    email: "asker@example.com",
    name: "Asker",
    image: undefined,
  },
} satisfies CurrentSessionSummary;

const completedSession = {
  status: "authenticated",
  profileStatus: "complete",
  suspensionStatus: "none",
  user: {
    id: "user_2",
    email: "asker@example.com",
    name: "Asker",
    image: undefined,
  },
  profile: {
    id: "profile_2",
    username: "asker",
    displayName: "Asker",
    avatarUrl: null,
  },
} satisfies CurrentSessionSummary;
