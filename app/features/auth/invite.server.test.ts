import { describe, expect, it } from "vitest";

import {
  completeInviteForCreatedUser,
  getInviteCodeHash,
  requireConsumedInviteForUserCreate,
  TEMPORARY_INVITE_COOKIE_NAME,
  type InviteStore,
  validateInviteCodeForSignIn,
} from "~/features/auth/invite.server";

const VALID_INVITE_CODE = "BETA-2026";

describe("validateInviteCodeForSignIn", () => {
  it("accepts a valid unused code", async () => {
    const store = createFakeInviteStore([
      createInvite({ id: "invite_1", code: VALID_INVITE_CODE }),
    ]);

    const result = await validateInviteCodeForSignIn(VALID_INVITE_CODE, store);

    expect(result.status).toBe("valid");
  });

  it("rejects a used code", async () => {
    const store = createFakeInviteStore([
      createInvite({
        id: "invite_1",
        code: VALID_INVITE_CODE,
        usedAt: new Date(),
      }),
    ]);

    const result = await validateInviteCodeForSignIn(VALID_INVITE_CODE, store);

    expect(result).toEqual({ status: "invalid", reason: "unavailable" });
  });

  it("rejects an expired code", async () => {
    const store = createFakeInviteStore([
      createInvite({
        id: "invite_1",
        code: VALID_INVITE_CODE,
        expiresAt: new Date(Date.now() - 1000),
      }),
    ]);

    const result = await validateInviteCodeForSignIn(VALID_INVITE_CODE, store);

    expect(result).toEqual({ status: "invalid", reason: "unavailable" });
  });

  it("rejects malformed codes", async () => {
    const store = createFakeInviteStore([]);

    const result = await validateInviteCodeForSignIn("bad!", store);

    expect(result).toEqual({ status: "invalid", reason: "malformed" });
  });
});

describe("requireConsumedInviteForUserCreate", () => {
  it("only consumes the same invite once", async () => {
    const store = createFakeInviteStore([
      createInvite({ id: "invite_1", code: VALID_INVITE_CODE }),
    ]);
    const validation = await validateInviteCodeForSignIn(VALID_INVITE_CODE, store);

    if (validation.status !== "valid") {
      throw new Error("test invite should be valid");
    }

    const cookieValue = getCookieValue(validation.cookieHeader);
    const [first, second] = await Promise.all([
      requireConsumedInviteForUserCreate(createContext(cookieValue), store),
      requireConsumedInviteForUserCreate(createContext(cookieValue), store),
    ]);

    expect([first, second].filter(Boolean)).toHaveLength(1);
  });

  it("blocks uninvited user creation", async () => {
    const store = createFakeInviteStore([]);

    await expect(
      requireConsumedInviteForUserCreate(createContext(undefined), store),
    ).resolves.toBe(false);
  });

  it("attaches a consumed invite to the created user", async () => {
    const store = createFakeInviteStore([
      createInvite({ id: "invite_1", code: VALID_INVITE_CODE }),
    ]);
    const validation = await validateInviteCodeForSignIn(VALID_INVITE_CODE, store);

    if (validation.status !== "valid") {
      throw new Error("test invite should be valid");
    }

    const context = createContext(getCookieValue(validation.cookieHeader));

    await requireConsumedInviteForUserCreate(context, store);
    await completeInviteForCreatedUser({ id: "user_1" }, context, store);

    expect(store.invites.get("invite_1")?.usedByUserId).toBe("user_1");
    expect(store.acceptedEvents).toEqual([
      { inviteId: "invite_1", userId: "user_1" },
    ]);
  });
});

interface FakeInvite {
  id: string;
  codeHash: string;
  expiresAt?: Date;
  usedAt?: Date;
  usedByUserId?: string;
}

function createFakeInviteStore(initialInvites: FakeInvite[]) {
  const invites = new Map(initialInvites.map((invite) => [invite.id, invite]));
  const acceptedEvents: { inviteId: string; userId: string }[] = [];

  const store: InviteStore = {
    findAvailableInviteByCodeHash(codeHash, now) {
      const invite = Array.from(invites.values()).find(
        (invite) =>
          invite.codeHash === codeHash &&
          invite.usedAt === undefined &&
          (invite.expiresAt === undefined || invite.expiresAt > now),
      );

      return Promise.resolve(invite);
    },
    consumeInvite(inviteId, now) {
      const invite = invites.get(inviteId);

      if (
        invite === undefined ||
        invite.usedAt !== undefined ||
        (invite.expiresAt !== undefined && invite.expiresAt <= now)
      ) {
        return Promise.resolve(undefined);
      }

      invite.usedAt = now;
      return Promise.resolve({ inviteId });
    },
    markInviteUsedByUser(inviteId, userId) {
      const invite = invites.get(inviteId);

      if (invite !== undefined) {
        invite.usedByUserId = userId;
      }

      return Promise.resolve();
    },
    recordInviteAccepted(event) {
      acceptedEvents.push(event);

      return Promise.resolve();
    },
  };

  return Object.assign(store, {
    acceptedEvents,
    invites,
  });
}

function createInvite({
  id,
  code,
  expiresAt,
  usedAt,
}: {
  id: string;
  code: string;
  expiresAt?: Date;
  usedAt?: Date;
}): FakeInvite {
  const invite: FakeInvite = {
    id,
    codeHash: getInviteCodeHash(code),
  };

  if (expiresAt !== undefined) {
    invite.expiresAt = expiresAt;
  }

  if (usedAt !== undefined) {
    invite.usedAt = usedAt;
  }

  return invite;
}

function createContext(cookieValue: string | undefined) {
  return {
    getCookie(key: string) {
      return key === TEMPORARY_INVITE_COOKIE_NAME && cookieValue !== undefined
        ? cookieValue
        : null;
    },
  };
}

function getCookieValue(cookieHeader: string) {
  const [nameAndValue] = cookieHeader.split(";");
  const prefix = `${TEMPORARY_INVITE_COOKIE_NAME}=`;

  if (!nameAndValue?.startsWith(prefix)) {
    throw new Error("temporary invite cookie missing from header");
  }

  return nameAndValue.slice(prefix.length);
}
