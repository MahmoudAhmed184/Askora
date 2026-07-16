import { describe, expect, it } from "vitest";

import {
  requireAdminSession,
  type AdminAuthStore,
} from "~/features/admin/services/admin-auth.service.server";
import type {
  AuthenticatedSessionSummary
} from "~/features/auth/services/auth.service.server";;

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

  it("throws 403 for authenticated non-admin users", async () => {
    await expect(
      requireAdminSession(new Request("http://localhost/admin"), {
        getAuthenticatedSession: () => Promise.resolve(authenticatedSession),
        store: {
          findUserRole: () => Promise.resolve("user"),
        },
      }),
    ).rejects.toMatchObject({
      data: "Forbidden",
      init: {
        status: 403,
        statusText: "Forbidden",
      },
    });
  });

  it("throws 403 for suspended admins before checking their role", async () => {
    let roleChecked = false;

    await expect(
      requireAdminSession(new Request("http://localhost/admin"), {
        getAuthenticatedSession: () =>
          Promise.resolve({
            ...authenticatedSession,
            suspensionStatus: "active",
          }),
        store: {
          findUserRole: () => {
            roleChecked = true;
            return Promise.resolve("admin");
          },
        },
      }),
    ).rejects.toMatchObject({
      data: "Forbidden",
      init: { status: 403 },
    });
    expect(roleChecked).toBe(false);
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
