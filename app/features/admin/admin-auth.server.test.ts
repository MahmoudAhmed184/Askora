import { describe, expect, it } from "vitest";

import {
  requireAdminSession,
  type AdminAuthStore,
} from "~/features/admin/admin-auth.server";
import type { AuthenticatedSessionSummary } from "~/features/auth/auth.server";

describe("requireAdminSession", () => {
  it("re-queries the database-backed user role before allowing admins", async () => {
    const calls: string[] = [];
    const store: AdminAuthStore = {
      findUserRole(userId) {
        calls.push(userId);
        return Promise.resolve("admin");
      },
    };

    const result = await requireAdminSession(new Request("http://localhost/admin"), {
      getAuthenticatedSession: () => Promise.resolve(authenticatedSession),
      store,
    });

    expect(calls).toEqual(["user_1"]);
    expect(result).toMatchObject({
      status: "authenticated",
      role: "admin",
    });
  });

  it("returns 403 for authenticated non-admin users", async () => {
    const result = await requireAdminSession(new Request("http://localhost/admin"), {
      getAuthenticatedSession: () => Promise.resolve(authenticatedSession),
      store: {
        findUserRole: () => Promise.resolve("user"),
      },
    });

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(403);
  });
});

const authenticatedSession = {
  status: "authenticated",
  profileStatus: "incomplete",
  suspensionStatus: "none",
  user: {
    id: "user_1",
    email: "admin@example.com",
    name: "Admin",
    image: undefined,
  },
} satisfies AuthenticatedSessionSummary;
