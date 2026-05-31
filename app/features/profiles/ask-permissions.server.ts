import type {
  CurrentSessionSummary,
  PublicSessionSummary,
} from "~/features/auth/auth.server";
import type { PublicQuestionIdentity } from "~/features/profiles/profile.schema";

export type QuestionIdentityMode =
  | "guest_anonymous"
  | "account_anonymous"
  | "account_attributed";

export type AskPermission = "everyone" | "logged_in" | "followers" | "off";
export type AskPermissionDeniedReason =
  | "profile_inactive"
  | "questions_closed"
  | "permission_off"
  | "login_required"
  | "followers_only"
  | "anonymous_disabled"
  | "profile_required"
  | "suspended";

export interface AskPermissionTarget {
  isActive: boolean;
  acceptingQuestions: boolean;
  anonymousQuestionsEnabled: boolean;
  askPermission: AskPermission;
  isFollowedByActor?: boolean;
}

export type AskPermissionDecision =
  | {
      status: "allowed";
      identityMode: QuestionIdentityMode;
    }
  | {
      status: "denied";
      reason: AskPermissionDeniedReason;
      message: string;
      action?: {
        label: string;
        href: string;
      } | undefined;
    };

export interface PublicAskStateAllowed {
  status: "allowed";
  defaultIdentity: PublicQuestionIdentity;
  anonymousAllowed: boolean;
  attributedAllowed: boolean;
  description: string;
}

export type PublicAskState =
  | PublicAskStateAllowed
  | {
      status: "denied";
      reason: AskPermissionDeniedReason;
      message: string;
      action?: {
        label: string;
        href: string;
      } | undefined;
    };

export function evaluateAskPermission({
  actor,
  identity,
  target,
}: {
  actor: CurrentSessionSummary | PublicSessionSummary;
  identity: PublicQuestionIdentity;
  target: AskPermissionTarget;
}): AskPermissionDecision {
  const baseDenial = getBaseAskDenial({ actor, target });

  if (baseDenial !== undefined) {
    return baseDenial;
  }

  if (target.askPermission === "followers") {
    return evaluateFollowersOnlyAskPermission({ actor, identity, target });
  }

  if (actor.status === "anonymous") {
    return evaluateGuestAskPermission({ identity, target });
  }

  if (target.askPermission === "logged_in" || target.askPermission === "everyone") {
    return evaluateAuthenticatedAskPermission({ actor, identity, target });
  }

  return denyQuestionsOff();
}

function evaluateFollowersOnlyAskPermission({
  actor,
  identity,
  target,
}: {
  actor: CurrentSessionSummary | PublicSessionSummary;
  identity: PublicQuestionIdentity;
  target: AskPermissionTarget;
}): AskPermissionDecision {
  if (actor.status === "anonymous") {
    return {
      status: "denied",
      reason: "login_required",
      message: "Log in and follow this profile to ask a question.",
      action: {
        label: "Log in",
        href: "/login",
      },
    };
  }

  if (actor.profileStatus === "incomplete") {
    return {
      status: "denied",
      reason: "profile_required",
      message: "Complete your profile to follow and ask this profile.",
      action: {
        label: "Complete profile",
        href: "/setup",
      },
    };
  }

  if (target.isFollowedByActor !== true) {
    return denyFollowersOnly();
  }

  if (identity === "anonymous") {
    return evaluateAuthenticatedAnonymousPermission({ target });
  }

  return {
    status: "allowed",
    identityMode: "account_attributed",
  };
}

export function getPublicAskState({
  actor,
  target,
}: {
  actor: CurrentSessionSummary | PublicSessionSummary;
  target: AskPermissionTarget;
}): PublicAskState {
  const anonymous = evaluateAskPermission({
    actor,
    identity: "anonymous",
    target,
  });
  const attributed = evaluateAskPermission({
    actor,
    identity: "attributed",
    target,
  });

  const anonymousAllowed = anonymous.status === "allowed";
  const attributedAllowed = attributed.status === "allowed";

  if (!anonymousAllowed && !attributedAllowed) {
    return {
      status: "denied",
      reason: anonymous.reason,
      message: anonymous.message,
      action: anonymous.action,
    };
  }

  return {
    status: "allowed",
    defaultIdentity: anonymousAllowed ? "anonymous" : "attributed",
    anonymousAllowed,
    attributedAllowed,
    description: getAllowedAskDescription({
      anonymousAllowed,
      attributedAllowed,
      actor,
    }),
  };
}

function getBaseAskDenial({
  actor,
  target,
}: {
  actor: CurrentSessionSummary | PublicSessionSummary;
  target: AskPermissionTarget;
}): AskPermissionDecision | undefined {
  if (!target.isActive) {
    return {
      status: "denied",
      reason: "profile_inactive",
      message: "This profile is not available for questions.",
    };
  }

  if (actor.status === "authenticated" && actor.suspensionStatus === "active") {
    return {
      status: "denied",
      reason: "suspended",
      message: "Asking is unavailable while your account is suspended.",
    };
  }

  if (!target.acceptingQuestions) {
    return {
      status: "denied",
      reason: "questions_closed",
      message: "This profile is not accepting new questions right now.",
    };
  }

  if (target.askPermission === "off") {
    return denyQuestionsOff();
  }

  return undefined;
}

function evaluateGuestAskPermission({
  identity,
  target,
}: {
  identity: PublicQuestionIdentity;
  target: AskPermissionTarget;
}): AskPermissionDecision {
  if (target.askPermission === "logged_in") {
    return {
      status: "denied",
      reason: "login_required",
      message: "Log in to ask this profile a question.",
      action: {
        label: "Log in",
        href: "/login",
      },
    };
  }

  if (identity === "attributed") {
    return {
      status: "denied",
      reason: "login_required",
      message: "Log in and complete a profile to ask with your name attached.",
      action: {
        label: "Log in",
        href: "/login",
      },
    };
  }

  if (!target.anonymousQuestionsEnabled) {
    return {
      status: "denied",
      reason: "anonymous_disabled",
      message: "This profile only accepts questions from signed-in profiles.",
      action: {
        label: "Log in",
        href: "/login",
      },
    };
  }

  return {
    status: "allowed",
    identityMode: "guest_anonymous",
  };
}

function evaluateAuthenticatedAskPermission({
  actor,
  identity,
  target,
}: {
  actor: Exclude<CurrentSessionSummary | PublicSessionSummary, { status: "anonymous" }>;
  identity: PublicQuestionIdentity;
  target: AskPermissionTarget;
}): AskPermissionDecision {
  if (identity === "anonymous") {
    return evaluateAuthenticatedAnonymousPermission({ target });
  }

  if (actor.profileStatus === "incomplete") {
    return {
      status: "denied",
      reason: "profile_required",
      message: "Complete your profile to ask with your name attached.",
      action: {
        label: "Complete profile",
        href: "/setup",
      },
    };
  }

  return {
    status: "allowed",
    identityMode: "account_attributed",
  };
}

function evaluateAuthenticatedAnonymousPermission({
  target,
}: {
  target: AskPermissionTarget;
}): AskPermissionDecision {
  if (!target.anonymousQuestionsEnabled) {
    return {
      status: "denied",
      reason: "anonymous_disabled",
      message: "This profile has anonymous questions turned off.",
    };
  }

  return {
    status: "allowed",
    identityMode: "account_anonymous",
  };
}

function denyFollowersOnly(): AskPermissionDecision {
  return {
    status: "denied",
    reason: "followers_only",
    message: "Only followers can ask this profile a question.",
  };
}

function denyQuestionsOff(): AskPermissionDecision {
  return {
    status: "denied",
    reason: "permission_off",
    message: "This profile has questions turned off.",
  };
}

function getAllowedAskDescription({
  anonymousAllowed,
  attributedAllowed,
  actor,
}: {
  anonymousAllowed: boolean;
  attributedAllowed: boolean;
  actor: CurrentSessionSummary | PublicSessionSummary;
}) {
  if (anonymousAllowed && attributedAllowed) {
    return "Choose whether to ask anonymously or with your profile attached.";
  }

  if (anonymousAllowed) {
    return actor.status === "anonymous"
      ? "Your question is anonymous to the recipient and public viewers."
      : "Your question is anonymous to the recipient and public viewers, but linked to your account for notifications.";
  }

  return "Your profile name will be attached if this question is answered publicly.";
}
