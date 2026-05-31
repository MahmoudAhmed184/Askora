import { eq } from "drizzle-orm";

import { getRuntimeDatabase, type RuntimeDatabase } from "~/db/client.server";
import { authUsers } from "~/db/schema";
import {
  requireAuthenticatedSession,
  type AuthenticatedSessionSummary,
} from "~/features/auth/auth.server";

export type AdminSession = AuthenticatedSessionSummary & {
  role: "admin";
};

export interface AdminAuthStore {
  findUserRole(userId: string): Promise<"user" | "admin" | undefined>;
}

export interface RequireAdminSessionOptions {
  getAuthenticatedSession?: (
    request: Request,
  ) => Promise<AuthenticatedSessionSummary | Response>;
  store?: AdminAuthStore;
}

export async function requireAdminSession(
  request: Request,
  options: RequireAdminSessionOptions = {},
): Promise<AdminSession | Response> {
  const getAuthenticatedSession =
    options.getAuthenticatedSession ?? requireAuthenticatedSession;
  const store = options.store ?? createDrizzleAdminAuthStore();
  const session = await getAuthenticatedSession(request);

  if (session instanceof Response) {
    return session;
  }

  const role = await store.findUserRole(session.user.id);

  if (role !== "admin") {
    return new Response("Forbidden", {
      status: 403,
      statusText: "Forbidden",
    });
  }

  return {
    ...session,
    role,
  };
}

export function createDrizzleAdminAuthStore(
  database: RuntimeDatabase = getRuntimeDatabase(),
): AdminAuthStore {
  return {
    async findUserRole(userId) {
      const [user] = await database
        .select({
          role: authUsers.role,
        })
        .from(authUsers)
        .where(eq(authUsers.id, userId))
        .limit(1);

      return user?.role;
    },
  };
}
