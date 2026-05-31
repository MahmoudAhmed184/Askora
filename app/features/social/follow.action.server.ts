import { and, eq, or } from "drizzle-orm";

import { getRuntimeDatabase, type RuntimeDatabase } from "~/db/client.server";
import { authUsers, blocks, follows, profiles } from "~/db/schema";
import type { CompletedProfileSessionSummary } from "~/features/auth/auth.server";
import {
  followActionSchema,
  followIntentValues,
  getSafeReturnTo,
  type FollowActionSubmission,
  type FollowIntent,
} from "~/features/social/social.schema";
import { parseFormData } from "~/lib/zod-form";
import type { ZodError } from "zod";

export interface FollowTargetProfile {
  id: string;
  userId: string;
  username: string;
  isActive: boolean;
  userDeletedAt: Date | null;
}

export interface FollowActionFormValues {
  intent: FollowIntent | "unknown";
  username: string;
  returnTo: string | undefined;
}

export interface FollowActionFieldErrors {
  intent?: string;
  username?: string;
}

export type FollowActionDeniedReason =
  | "not_found"
  | "self_follow"
  | "blocked"
  | "suspended";

export type FollowActionResult =
  | {
      status: "followed" | "unfollowed";
      username: string;
      redirectTo: string;
    }
  | {
      status: "invalid";
      values: FollowActionFormValues;
      fieldErrors: FollowActionFieldErrors;
      formError: string;
    }
  | {
      status: "denied";
      values: FollowActionFormValues;
      reason: FollowActionDeniedReason;
      formError: string;
    };

export interface FollowMutationParams {
  now: Date;
  session: CompletedProfileSessionSummary;
  target: FollowTargetProfile;
}

export interface FollowActionStore {
  findTargetProfileByUsername(
    username: string,
  ): Promise<FollowTargetProfile | undefined>;
  isActorBlockedByTarget(params: {
    actorProfileId: string;
    actorUserId: string;
    targetProfileId: string;
  }): Promise<boolean>;
  followProfile(params: FollowMutationParams): Promise<void>;
  unfollowProfile(params: FollowMutationParams): Promise<void>;
}

export async function handleFollowAction({
  formData,
  now = new Date(),
  session,
  store = createDrizzleFollowActionStore(),
}: {
  formData: FormData;
  session: CompletedProfileSessionSummary;
  store?: FollowActionStore;
  now?: Date;
}): Promise<FollowActionResult> {
  const values = getFollowActionFormValues(formData);

  if (session.suspensionStatus === "active") {
    return deniedResult(values, "suspended");
  }

  const parsed = parseFormData(followActionSchema, formData);

  if (!parsed.ok) {
    return invalidResult(values, parsed.error);
  }

  const target = await findAllowedFollowTarget({
    session,
    store,
    username: parsed.value.username,
  });

  if (target.status === "denied") {
    return deniedResult(values, target.reason);
  }

  return mutateFollow({
    form: parsed.value,
    now,
    session,
    store,
    target: target.profile,
  });
}

export function createDrizzleFollowActionStore(
  database: RuntimeDatabase = getRuntimeDatabase(),
): FollowActionStore {
  return {
    async findTargetProfileByUsername(username) {
      const [profile] = await database
        .select({
          id: profiles.id,
          userId: profiles.userId,
          username: profiles.username,
          isActive: profiles.isActive,
          userDeletedAt: authUsers.deletedAt,
        })
        .from(profiles)
        .leftJoin(authUsers, eq(authUsers.id, profiles.userId))
        .where(eq(profiles.username, username))
        .limit(1);

      return profile;
    },
    async isActorBlockedByTarget({
      actorProfileId,
      actorUserId,
      targetProfileId,
    }) {
      const [block] = await database
        .select({ id: blocks.id })
        .from(blocks)
        .where(
          and(
            eq(blocks.ownerProfileId, targetProfileId),
            or(
              eq(blocks.blockedUserId, actorUserId),
              eq(blocks.blockedProfileId, actorProfileId),
            ),
          ),
        )
        .limit(1);

      return block !== undefined;
    },
    async followProfile({ now, session, target }) {
      await database
        .insert(follows)
        .values({
          followerProfileId: session.profile.id,
          followedProfileId: target.id,
          createdAt: now,
        })
        .onConflictDoNothing();
    },
    async unfollowProfile({ session, target }) {
      await database
        .delete(follows)
        .where(
          and(
            eq(follows.followerProfileId, session.profile.id),
            eq(follows.followedProfileId, target.id),
          ),
        );
    },
  };
}

async function findAllowedFollowTarget({
  session,
  store,
  username,
}: {
  session: CompletedProfileSessionSummary;
  store: FollowActionStore;
  username: string;
}): Promise<
  | {
      status: "allowed";
      profile: FollowTargetProfile;
    }
  | {
      status: "denied";
      reason: FollowActionDeniedReason;
    }
> {
  const profile = await store.findTargetProfileByUsername(username);

  if (profile === undefined || !isAvailableTargetProfile(profile)) {
    return { status: "denied", reason: "not_found" };
  }

  if (isSelfFollow({ profile, session })) {
    return { status: "denied", reason: "self_follow" };
  }

  const blocked = await store.isActorBlockedByTarget({
    actorProfileId: session.profile.id,
    actorUserId: session.user.id,
    targetProfileId: profile.id,
  });

  if (blocked) {
    return { status: "denied", reason: "blocked" };
  }

  return { status: "allowed", profile };
}

async function mutateFollow({
  form,
  now,
  session,
  store,
  target,
}: {
  form: FollowActionSubmission;
  now: Date;
  session: CompletedProfileSessionSummary;
  store: FollowActionStore;
  target: FollowTargetProfile;
}): Promise<FollowActionResult> {
  const params = { now, session, target };

  if (form.intent === "unfollow") {
    await store.unfollowProfile(params);

    return successResult({
      form,
      status: "unfollowed",
    });
  }

  await store.followProfile(params);

  return successResult({
    form,
    status: "followed",
  });
}

function successResult({
  form,
  status,
}: {
  form: FollowActionSubmission;
  status: "followed" | "unfollowed";
}): FollowActionResult {
  return {
    status,
    username: form.username,
    redirectTo: getSafeReturnTo(form.returnTo, `/${form.username}`),
  };
}

function invalidResult(
  values: FollowActionFormValues,
  error: ZodError,
): FollowActionResult {
  return {
    status: "invalid",
    values,
    fieldErrors: getFollowActionFieldErrors(error),
    formError: "Check the follow action and try again.",
  };
}

function deniedResult(
  values: FollowActionFormValues,
  reason: FollowActionDeniedReason,
): FollowActionResult {
  return {
    status: "denied",
    values,
    reason,
    formError: getDeniedMessage(reason),
  };
}

function getDeniedMessage(reason: FollowActionDeniedReason) {
  switch (reason) {
    case "not_found":
      return "Profile could not be found.";
    case "self_follow":
      return "You cannot follow your own profile.";
    case "blocked":
      return "This profile is unavailable.";
    case "suspended":
      return "Following profiles is unavailable while this account is suspended.";
  }
}

function getFollowActionFieldErrors(
  error: ZodError,
): FollowActionFieldErrors {
  const fieldErrors: FollowActionFieldErrors = {};

  for (const issue of error.issues) {
    const field = issue.path[0];

    if (field === "intent" && fieldErrors.intent === undefined) {
      fieldErrors.intent = issue.message;
    }

    if (field === "username" && fieldErrors.username === undefined) {
      fieldErrors.username = issue.message;
    }
  }

  return fieldErrors;
}

function getFollowActionFormValues(formData: FormData): FollowActionFormValues {
  const intent = getFormText(formData, "intent");

  return {
    intent: isFollowIntent(intent) ? intent : "unknown",
    username: getFormText(formData, "username") ?? "",
    returnTo: getFormText(formData, "returnTo"),
  };
}

function isAvailableTargetProfile(profile: FollowTargetProfile) {
  return profile.isActive && profile.userDeletedAt === null;
}

function isSelfFollow({
  profile,
  session,
}: {
  profile: FollowTargetProfile;
  session: CompletedProfileSessionSummary;
}) {
  return profile.id === session.profile.id || profile.userId === session.user.id;
}

function isFollowIntent(value: string | undefined): value is FollowIntent {
  return followIntentValues.includes(value as FollowIntent);
}

function getFormText(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : undefined;
}
