import { describe, expect, it, vi } from "vitest";

import { loader } from "~/features/notifications/routes/unread-count.route";
import type { CompletedProfileSessionSummary } from "~/features/auth/services/auth.service.server";

describe("unread notification count route", () => {
  it("returns only the current user's unread count without caching", async () => {
    const readUnreadNotificationCount = vi.fn().mockResolvedValue(3);
    const response = await loader(
      { context: createSessionContext(completedSession) } as never,
      readUnreadNotificationCount,
    );

    expect(readUnreadNotificationCount).toHaveBeenCalledWith({
      recipientUserId: completedSession.user.id,
    });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(response.json()).resolves.toEqual({
      profileHref: "/person",
      unreadNotificationCount: 3,
    });
  });

  it("redirects anonymous requests without reading notification data", async () => {
    const readUnreadNotificationCount = vi.fn();
    const response = await loader(
      { context: createSessionContext({ status: "anonymous" }) } as never,
      readUnreadNotificationCount,
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/login");
    expect(readUnreadNotificationCount).not.toHaveBeenCalled();
  });
});

function createSessionContext(
  session: CompletedProfileSessionSummary | { status: "anonymous" },
) {
  return {
    get: () => session,
  };
}

const completedSession = {
  status: "authenticated",
  user: {
    id: "user-1",
    email: "person@example.test",
    name: "Person",
    image: undefined,
  },
  profileStatus: "complete",
  suspensionStatus: "none",
  profile: {
    id: "profile-1",
    username: "person",
    displayName: "Person",
    avatarUrl: null,
  },
} satisfies CompletedProfileSessionSummary;
