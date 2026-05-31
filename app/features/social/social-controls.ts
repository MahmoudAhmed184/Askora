import type { CurrentSessionSummary } from "~/features/auth/auth.server";

export interface FollowControlTarget {
  id: string;
  userId: string;
  username: string;
  isActive: boolean;
}

export interface FollowControlState {
  visible: boolean;
  username: string;
  isFollowing: boolean;
  disabled: boolean;
}

export interface LikeControlState {
  threadItemPublicId: string;
  isLiked: boolean;
  count: number | undefined;
  disabled: boolean;
}

export interface LikeControlTarget {
  ownerProfileId: string;
  ownerUserId: string;
  threadItemPublicId: string;
}

export function getFollowControlState({
  isFollowing,
  session,
  target,
}: {
  session: CurrentSessionSummary;
  target: FollowControlTarget;
  isFollowing: boolean;
}): FollowControlState {
  if (
    session.status !== "authenticated" ||
    session.profileStatus !== "complete" ||
    !target.isActive ||
    session.profile.id === target.id ||
    session.user.id === target.userId
  ) {
    return {
      visible: false,
      username: target.username,
      isFollowing: false,
      disabled: false,
    };
  }

  return {
    visible: true,
    username: target.username,
    isFollowing,
    disabled: session.suspensionStatus === "active",
  };
}

export function getLikeControlState({
  count,
  isLiked,
  session,
  target,
}: {
  session: CurrentSessionSummary;
  target: LikeControlTarget;
  isLiked: boolean;
  count: number | undefined;
}): LikeControlState {
  return {
    threadItemPublicId: target.threadItemPublicId,
    isLiked,
    count,
    disabled: !canToggleLike({ session, target }),
  };
}

function canToggleLike({
  session,
  target,
}: {
  session: CurrentSessionSummary;
  target: LikeControlTarget;
}) {
  return (
    session.status === "authenticated" &&
    session.profileStatus === "complete" &&
    session.suspensionStatus !== "active" &&
    session.profile.id !== target.ownerProfileId &&
    session.user.id !== target.ownerUserId
  );
}
