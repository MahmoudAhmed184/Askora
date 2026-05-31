import type { CurrentSessionSummary } from "~/features/auth/auth.server";
import type { PublicQuestionIdentity } from "~/features/profiles/profile.schema";
import type { QuestionIdentityMode } from "~/features/profiles/ask-permissions.server";
import type { FollowUpPermission } from "~/features/settings/settings.schema";

export const MAX_PUBLISHED_THREAD_ITEMS = 20;

export type ThreadFollowUpDeniedReason =
  | "thread_unavailable"
  | "follow_ups_disabled"
  | "permission_off"
  | "login_required"
  | "anonymous_disabled"
  | "profile_required"
  | "suspended"
  | "thread_full"
  | "original_asker_required"
  | "original_asker_unavailable";

export interface ThreadFollowUpTarget {
  status: "draft" | "published" | "unpublished" | "deleted";
  ownerIsActive: boolean;
  ownerUserDeletedAt: Date | null;
  anonymousQuestionsEnabled: boolean;
  followUpsEnabled: boolean;
  followUpPermissionDefault: FollowUpPermission;
  followUpPermissionOverride: FollowUpPermission | null;
  initialQuestionAskerUserId: string | null;
  publishedItemCount: number;
}

export type ThreadFollowUpPermissionDecision =
  | {
      status: "allowed";
      identityMode: QuestionIdentityMode;
      effectivePermission: FollowUpPermission;
    }
  | {
      status: "denied";
      reason: ThreadFollowUpDeniedReason;
      message: string;
      action?: {
        label: string;
        href: string;
      } | undefined;
    };

export type PublicThreadFollowUpState =
  | {
      status: "allowed";
      defaultIdentity: PublicQuestionIdentity;
      anonymousAllowed: boolean;
      attributedAllowed: boolean;
      description: string;
      effectivePermission: FollowUpPermission;
    }
  | {
      status: "denied";
      reason: ThreadFollowUpDeniedReason;
      message: string;
      action?: {
        label: string;
        href: string;
      } | undefined;
    };

export function evaluateThreadFollowUpPermission({
  actor,
  identity,
  target,
}: {
  actor: CurrentSessionSummary;
  identity: PublicQuestionIdentity;
  target: ThreadFollowUpTarget;
}): ThreadFollowUpPermissionDecision {
  const baseDenial = getBaseFollowUpDenial({ actor, target });

  if (baseDenial !== undefined) {
    return baseDenial;
  }

  const effectivePermission = getEffectiveFollowUpPermission(target);
  const permissionDenial = getFollowUpPermissionDenial({
    actor,
    effectivePermission,
    target,
  });

  if (permissionDenial !== undefined) {
    return permissionDenial;
  }

  return evaluateFollowUpIdentity({
    actor,
    effectivePermission,
    identity,
    target,
  });
}

export function getPublicThreadFollowUpState({
  actor,
  target,
}: {
  actor: CurrentSessionSummary;
  target: ThreadFollowUpTarget;
}): PublicThreadFollowUpState {
  const anonymous = evaluateThreadFollowUpPermission({
    actor,
    identity: "anonymous",
    target,
  });
  const attributed = evaluateThreadFollowUpPermission({
    actor,
    identity: "attributed",
    target,
  });
  const anonymousAllowed = anonymous.status === "allowed";
  const attributedAllowed = attributed.status === "allowed";

  if (!anonymousAllowed && !attributedAllowed) {
    return getDeniedFollowUpState(anonymous, attributed);
  }

  const effectivePermission =
    anonymous.status === "allowed"
      ? anonymous.effectivePermission
      : attributed.status === "allowed"
        ? attributed.effectivePermission
        : getEffectiveFollowUpPermission(target);

  return {
    status: "allowed",
    defaultIdentity: anonymousAllowed ? "anonymous" : "attributed",
    anonymousAllowed,
    attributedAllowed,
    description: getAllowedFollowUpDescription({
      actor,
      anonymousAllowed,
      attributedAllowed,
      effectivePermission,
    }),
    effectivePermission,
  };
}

export function getEffectiveFollowUpPermission(
  target: Pick<
    ThreadFollowUpTarget,
    "followUpPermissionDefault" | "followUpPermissionOverride"
  >,
) {
  return target.followUpPermissionOverride ?? target.followUpPermissionDefault;
}

function getBaseFollowUpDenial({
  actor,
  target,
}: {
  actor: CurrentSessionSummary;
  target: ThreadFollowUpTarget;
}): ThreadFollowUpPermissionDecision | undefined {
  if (!isThreadAvailableForFollowUps(target)) {
    return denyFollowUp("thread_unavailable");
  }

  if (!target.followUpsEnabled) {
    return denyFollowUp("follow_ups_disabled");
  }

  if (actor.status === "authenticated" && actor.suspensionStatus === "active") {
    return denyFollowUp("suspended");
  }

  if (target.publishedItemCount >= MAX_PUBLISHED_THREAD_ITEMS) {
    return denyFollowUp("thread_full");
  }

  return undefined;
}

function getFollowUpPermissionDenial({
  actor,
  effectivePermission,
  target,
}: {
  actor: CurrentSessionSummary;
  effectivePermission: FollowUpPermission;
  target: ThreadFollowUpTarget;
}): ThreadFollowUpPermissionDecision | undefined {
  if (effectivePermission === "off") {
    return denyFollowUp("permission_off");
  }

  if (effectivePermission !== "original_asker") {
    return undefined;
  }

  if (target.initialQuestionAskerUserId === null) {
    return denyFollowUp("original_asker_unavailable");
  }

  if (actor.status === "anonymous") {
    return denyFollowUp("login_required");
  }

  if (actor.user.id !== target.initialQuestionAskerUserId) {
    return denyFollowUp("original_asker_required");
  }

  return undefined;
}

function evaluateFollowUpIdentity({
  actor,
  effectivePermission,
  identity,
  target,
}: {
  actor: CurrentSessionSummary;
  effectivePermission: FollowUpPermission;
  identity: PublicQuestionIdentity;
  target: ThreadFollowUpTarget;
}): ThreadFollowUpPermissionDecision {
  if (actor.status === "anonymous") {
    return evaluateGuestFollowUpIdentity({
      effectivePermission,
      identity,
      target,
    });
  }

  return evaluateAuthenticatedFollowUpIdentity({ actor, identity, target });
}

function evaluateGuestFollowUpIdentity({
  effectivePermission,
  identity,
  target,
}: {
  effectivePermission: FollowUpPermission;
  identity: PublicQuestionIdentity;
  target: ThreadFollowUpTarget;
}): ThreadFollowUpPermissionDecision {
  if (effectivePermission === "logged_in") {
    return denyFollowUp("login_required");
  }

  if (identity === "attributed") {
    return denyFollowUp("login_required");
  }

  if (!target.anonymousQuestionsEnabled) {
    return denyFollowUp("anonymous_disabled");
  }

  return {
    status: "allowed",
    identityMode: "guest_anonymous",
    effectivePermission,
  };
}

function evaluateAuthenticatedFollowUpIdentity({
  actor,
  identity,
  target,
}: {
  actor: Exclude<CurrentSessionSummary, { status: "anonymous" }>;
  identity: PublicQuestionIdentity;
  target: ThreadFollowUpTarget;
}): ThreadFollowUpPermissionDecision {
  if (identity === "anonymous") {
    return evaluateAuthenticatedAnonymousFollowUpIdentity({ target });
  }

  if (actor.profileStatus === "incomplete") {
    return denyFollowUp("profile_required");
  }

  return {
    status: "allowed",
    identityMode: "account_attributed",
    effectivePermission: getEffectiveFollowUpPermission(target),
  };
}

function evaluateAuthenticatedAnonymousFollowUpIdentity({
  target,
}: {
  target: ThreadFollowUpTarget;
}): ThreadFollowUpPermissionDecision {
  if (!target.anonymousQuestionsEnabled) {
    return denyFollowUp("anonymous_disabled");
  }

  return {
    status: "allowed",
    identityMode: "account_anonymous",
    effectivePermission: getEffectiveFollowUpPermission(target),
  };
}

function getDeniedFollowUpState(
  anonymous: ThreadFollowUpPermissionDecision,
  attributed: ThreadFollowUpPermissionDecision,
): PublicThreadFollowUpState {
  if (anonymous.status === "denied" && attributed.status === "denied") {
    return getMostHelpfulDenial(anonymous, attributed);
  }

  throw new Error("expected denied follow-up decisions");
}

function getMostHelpfulDenial(
  anonymous: Extract<ThreadFollowUpPermissionDecision, { status: "denied" }>,
  attributed: Extract<ThreadFollowUpPermissionDecision, { status: "denied" }>,
) {
  if (
    anonymous.reason === "anonymous_disabled" &&
    attributed.reason === "login_required"
  ) {
    return attributed;
  }

  return anonymous;
}

function getAllowedFollowUpDescription({
  actor,
  anonymousAllowed,
  attributedAllowed,
  effectivePermission,
}: {
  actor: CurrentSessionSummary;
  anonymousAllowed: boolean;
  attributedAllowed: boolean;
  effectivePermission: FollowUpPermission;
}) {
  if (effectivePermission === "original_asker") {
    return "Only the original asker can continue this thread.";
  }

  if (anonymousAllowed && attributedAllowed) {
    return "Choose whether to send this follow-up anonymously or with your profile attached.";
  }

  if (anonymousAllowed) {
    return actor.status === "anonymous"
      ? "Your follow-up is anonymous to the recipient and public viewers."
      : "Your follow-up is anonymous to the recipient and public viewers, but linked to your account for notifications.";
  }

  return "Your profile name will be attached if this follow-up is answered publicly.";
}

function isThreadAvailableForFollowUps(target: ThreadFollowUpTarget) {
  return (
    target.status === "published" &&
    target.ownerIsActive &&
    target.ownerUserDeletedAt === null
  );
}

function denyFollowUp(
  reason: ThreadFollowUpDeniedReason,
): ThreadFollowUpPermissionDecision {
  return {
    status: "denied",
    reason,
    message: getDeniedMessage(reason),
    action: getDeniedAction(reason),
  };
}

function getDeniedMessage(reason: ThreadFollowUpDeniedReason) {
  switch (reason) {
    case "thread_unavailable":
      return "This thread is unavailable for follow-ups.";
    case "follow_ups_disabled":
    case "permission_off":
      return "This thread is not accepting follow-ups.";
    case "login_required":
      return "Log in to send a follow-up.";
    case "anonymous_disabled":
      return "This profile only accepts follow-ups from signed-in profiles.";
    case "profile_required":
      return "Complete your profile to send this follow-up with your name attached.";
    case "suspended":
      return "Follow-ups are unavailable while your account is suspended.";
    case "thread_full":
      return "This thread already has the maximum number of published answers.";
    case "original_asker_required":
      return "Only the original asker can send follow-ups.";
    case "original_asker_unavailable":
      return "This thread is not accepting guest follow-ups.";
  }
}

function getDeniedAction(reason: ThreadFollowUpDeniedReason) {
  if (reason === "login_required" || reason === "anonymous_disabled") {
    return {
      label: "Log in",
      href: "/login",
    };
  }

  if (reason === "profile_required") {
    return {
      label: "Complete profile",
      href: "/setup",
    };
  }

  return undefined;
}
