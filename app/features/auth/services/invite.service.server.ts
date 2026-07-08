import { and, eq, gt, isNull, or } from "drizzle-orm";
import { z } from "zod";

import { getRuntimeDatabase, type RuntimeDatabase } from "~/db/client.server";
import { events, inviteCodes } from "~/db/schema";
import { inviteCodeSchema } from "~/features/auth/validations/invite.validations";
import {
  hashWithHmacSha256,
  sealJsonForCookie,
  unsealJsonFromCookie,
} from "~/lib/crypto.server";
import { serverEnv } from "~/lib/env.server";
import { createDatabaseId } from "~/lib/ids.server";

export const TEMPORARY_INVITE_COOKIE_NAME = "qna_invite_state";

const TEMPORARY_INVITE_COOKIE_PURPOSE = "auth-invite";
const TEMPORARY_INVITE_COOKIE_MAX_AGE_SECONDS = 60 * 30;

const temporaryInviteStateSchema = z.object({
  inviteId: z.string().min(1),
  createdAt: z.number().int().nonnegative(),
});

type TemporaryInviteState = z.infer<typeof temporaryInviteStateSchema>;

export type InviteCodeValidationResult =
  | {
      status: "valid";
      inviteId: string;
      cookieHeader: string;
    }
  | {
      status: "invalid";
      reason: "malformed" | "unavailable";
    };

export interface InviteStore {
  findAvailableInviteByCodeHash(
    codeHash: string,
    now: Date,
  ): Promise<{ id: string } | undefined>;
  consumeInvite(
    inviteId: string,
    now: Date,
  ): Promise<{ inviteId: string } | undefined>;
  markInviteUsedByUser(inviteId: string, userId: string): Promise<void>;
  recordInviteAccepted(event: InviteAcceptedEvent): Promise<void>;
}

interface InviteAcceptedEvent {
  inviteId: string;
  userId: string;
}

interface InviteHookContext {
  getCookie(key: string): string | null;
}

interface CreatedAuthUser {
  id: string;
}

const consumedInvitesByContext = new WeakMap<object, { inviteId: string }>();

export async function validateInviteCodeForSignIn(
  rawCode: string,
  store: InviteStore = createDrizzleInviteStore(),
): Promise<InviteCodeValidationResult> {
  const parsedCode = inviteCodeSchema.safeParse(rawCode);

  if (!parsedCode.success) {
    return { status: "invalid", reason: "malformed" };
  }

  const invite = await store.findAvailableInviteByCodeHash(
    getInviteCodeHash(parsedCode.data),
    new Date(),
  );

  if (invite === undefined) {
    return { status: "invalid", reason: "unavailable" };
  }

  return {
    status: "valid",
    inviteId: invite.id,
    cookieHeader: createTemporaryInviteCookieHeader(invite.id),
  };
}

export async function requireConsumedInviteForUserCreate(
  context: (InviteHookContext & object) | null,
  store: InviteStore = createDrizzleInviteStore(),
) {
  if (context === null) {
    return false;
  }

  const inviteState = getTemporaryInviteStateFromContext(context);

  if (inviteState === undefined) {
    return false;
  }

  const consumedInvite = await store.consumeInvite(inviteState.inviteId, new Date());

  if (consumedInvite === undefined) {
    return false;
  }

  consumedInvitesByContext.set(context, consumedInvite);
  return true;
}

export async function completeInviteForCreatedUser(
  user: CreatedAuthUser,
  context: (InviteHookContext & object) | null,
  store: InviteStore = createDrizzleInviteStore(),
) {
  if (context === null) {
    return;
  }

  const consumedInvite = consumedInvitesByContext.get(context);

  if (consumedInvite === undefined) {
    return;
  }

  await store.markInviteUsedByUser(consumedInvite.inviteId, user.id);
  await store.recordInviteAccepted({
    inviteId: consumedInvite.inviteId,
    userId: user.id,
  });
  consumedInvitesByContext.delete(context);
}

export function getInviteCodeHash(inviteCode: string) {
  return hashWithHmacSha256(inviteCode, "invite-code");
}

export function createTemporaryInviteCookieHeader(inviteId: string) {
  const value = sealJsonForCookie(
    {
      inviteId,
      createdAt: Date.now(),
    } satisfies TemporaryInviteState,
    TEMPORARY_INVITE_COOKIE_PURPOSE,
  );

  return serializeTemporaryInviteCookie(value, TEMPORARY_INVITE_COOKIE_MAX_AGE_SECONDS);
}

export function clearTemporaryInviteCookieHeader() {
  return serializeTemporaryInviteCookie("", 0);
}

export function createDrizzleInviteStore(
  database: RuntimeDatabase = getRuntimeDatabase(),
): InviteStore {
  return {
    async findAvailableInviteByCodeHash(codeHash, now) {
      const [invite] = await database
        .select({ id: inviteCodes.id })
        .from(inviteCodes)
        .where(getAvailableInviteWhereClause({ codeHash, now }))
        .limit(1);

      return invite;
    },
    async consumeInvite(inviteId, now) {
      const [invite] = await database
        .update(inviteCodes)
        .set({ usedAt: now })
        .where(getConsumableInviteWhereClause({ inviteId, now }))
        .returning({ inviteId: inviteCodes.id });

      return invite;
    },
    async markInviteUsedByUser(inviteId, userId) {
      await database
        .update(inviteCodes)
        .set({ usedByUserId: userId })
        .where(eq(inviteCodes.id, inviteId));
    },
    async recordInviteAccepted({ inviteId, userId }) {
      await database.insert(events).values({
        id: createDatabaseId(),
        userId,
        type: "invite_accepted",
        metadata: {
          inviteId,
        },
      });
    },
  };
}

function getTemporaryInviteStateFromContext(context: InviteHookContext) {
  const cookieValue = context.getCookie(TEMPORARY_INVITE_COOKIE_NAME);

  if (cookieValue === null) {
    return undefined;
  }

  return getTemporaryInviteStateFromCookie(cookieValue);
}

function getTemporaryInviteStateFromCookie(cookieValue: string) {
  const unsealed = unsealJsonFromCookie(
    cookieValue,
    TEMPORARY_INVITE_COOKIE_PURPOSE,
  );
  const parsed = temporaryInviteStateSchema.safeParse(unsealed);

  if (!parsed.success || isTemporaryInviteStateExpired(parsed.data)) {
    return undefined;
  }

  return parsed.data;
}

function isTemporaryInviteStateExpired(state: TemporaryInviteState) {
  return (
    Date.now() - state.createdAt >
    TEMPORARY_INVITE_COOKIE_MAX_AGE_SECONDS * 1000
  );
}

function getAvailableInviteWhereClause({
  codeHash,
  now,
}: {
  codeHash: string;
  now: Date;
}) {
  return and(
    eq(inviteCodes.codeHash, codeHash),
    isNull(inviteCodes.usedAt),
    or(isNull(inviteCodes.expiresAt), gt(inviteCodes.expiresAt, now)),
  );
}

function getConsumableInviteWhereClause({
  inviteId,
  now,
}: {
  inviteId: string;
  now: Date;
}) {
  return and(
    eq(inviteCodes.id, inviteId),
    isNull(inviteCodes.usedAt),
    or(isNull(inviteCodes.expiresAt), gt(inviteCodes.expiresAt, now)),
  );
}

function serializeTemporaryInviteCookie(value: string, maxAgeSeconds: number) {
  const cookieParts = [
    `${TEMPORARY_INVITE_COOKIE_NAME}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${String(maxAgeSeconds)}`,
  ];

  if (serverEnv.NODE_ENV === "production") {
    cookieParts.push("Secure");
  }

  return cookieParts.join("; ");
}
