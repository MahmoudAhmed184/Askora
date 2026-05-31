import { describe, expect, it } from "vitest";

import type { CurrentSessionSummary } from "~/features/auth/auth.server";
import {
  evaluateThreadFollowUpPermission,
  MAX_PUBLISHED_THREAD_ITEMS,
  type ThreadFollowUpTarget,
} from "~/features/threads/thread-permissions.server";

describe("evaluateThreadFollowUpPermission", () => {
  it("allows anyone follow-ups for guests when anonymous questions are enabled", () => {
    expect(
      evaluateThreadFollowUpPermission({
        actor: anonymousSession,
        identity: "anonymous",
        target: createTarget({ followUpPermissionDefault: "anyone" }),
      }),
    ).toMatchObject({
      status: "allowed",
      identityMode: "guest_anonymous",
      effectivePermission: "anyone",
    });
  });

  it("requires login for logged-in follow-ups", () => {
    expect(
      evaluateThreadFollowUpPermission({
        actor: anonymousSession,
        identity: "anonymous",
        target: createTarget({ followUpPermissionDefault: "logged_in" }),
      }),
    ).toMatchObject({
      status: "denied",
      reason: "login_required",
    });

    expect(
      evaluateThreadFollowUpPermission({
        actor: completedSession,
        identity: "attributed",
        target: createTarget({ followUpPermissionDefault: "logged_in" }),
      }),
    ).toMatchObject({
      status: "allowed",
      identityMode: "account_attributed",
    });
  });

  it("denies off, suspended, and capped threads", () => {
    expect(
      evaluateThreadFollowUpPermission({
        actor: completedSession,
        identity: "attributed",
        target: createTarget({ followUpPermissionDefault: "off" }),
      }),
    ).toMatchObject({
      status: "denied",
      reason: "permission_off",
    });

    expect(
      evaluateThreadFollowUpPermission({
        actor: { ...completedSession, suspensionStatus: "active" },
        identity: "attributed",
        target: createTarget(),
      }),
    ).toMatchObject({
      status: "denied",
      reason: "suspended",
    });

    expect(
      evaluateThreadFollowUpPermission({
        actor: completedSession,
        identity: "attributed",
        target: createTarget({
          publishedItemCount: MAX_PUBLISHED_THREAD_ITEMS,
        }),
      }),
    ).toMatchObject({
      status: "denied",
      reason: "thread_full",
    });
  });

  it("denies guest original askers when continuity cannot be proven", () => {
    expect(
      evaluateThreadFollowUpPermission({
        actor: anonymousSession,
        identity: "anonymous",
        target: createTarget({
          followUpPermissionDefault: "original_asker",
          initialQuestionAskerUserId: null,
        }),
      }),
    ).toMatchObject({
      status: "denied",
      reason: "original_asker_unavailable",
    });
  });

  it("allows only the matching account-backed original asker", () => {
    const target = createTarget({
      followUpPermissionDefault: "original_asker",
      initialQuestionAskerUserId: "user_2",
    });

    expect(
      evaluateThreadFollowUpPermission({
        actor: completedSession,
        identity: "anonymous",
        target,
      }),
    ).toMatchObject({
      status: "allowed",
      identityMode: "account_anonymous",
    });

    expect(
      evaluateThreadFollowUpPermission({
        actor: {
          ...completedSession,
          user: { ...completedSession.user, id: "other_user" },
        },
        identity: "anonymous",
        target,
      }),
    ).toMatchObject({
      status: "denied",
      reason: "original_asker_required",
    });
  });

  it("uses the thread override before the profile default", () => {
    expect(
      evaluateThreadFollowUpPermission({
        actor: completedSession,
        identity: "attributed",
        target: createTarget({
          followUpPermissionDefault: "anyone",
          followUpPermissionOverride: "off",
        }),
      }),
    ).toMatchObject({
      status: "denied",
      reason: "permission_off",
    });
  });
});

function createTarget(
  overrides: Partial<ThreadFollowUpTarget> = {},
): ThreadFollowUpTarget {
  return {
    status: "published",
    ownerIsActive: true,
    ownerUserDeletedAt: null,
    anonymousQuestionsEnabled: true,
    followUpsEnabled: true,
    followUpPermissionDefault: "anyone",
    followUpPermissionOverride: null,
    initialQuestionAskerUserId: "user_original",
    publishedItemCount: 1,
    ...overrides,
  };
}

const anonymousSession = {
  status: "anonymous",
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
