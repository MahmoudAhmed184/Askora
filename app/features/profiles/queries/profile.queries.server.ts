import { and, eq } from "drizzle-orm";

import { getRuntimeDatabase, type RuntimeDatabase } from "~/db/client.server";
import { authUsers, follows, profiles, usernameReservations } from "~/db/schema";
import {
  getPublicAskState,
  type AskPermission,
  type PublicAskState,
} from "~/features/profiles/services/ask-permissions.service.server";
import {
  createAskTimingToken,
  type PublicAskFlash,
} from "~/features/profiles/services/ask-friction.service.server";
import type {
  CurrentSessionSummary
} from "~/features/auth/services/auth.service.server";;
import type {
  PublicPublishedAnswer
} from "~/features/answers/services/answer.service.server";;
import {
  hiddenPublishedAnswerControls,
  type PublishedAnswerControlState,
} from "~/features/answers/published-answer-controls";
import {
  getFollowControlState,
  type FollowControlState,
} from "~/features/social/social-controls";
import type { PublicProfileSocialStats } from "~/features/social/services/social-data.service.server";

export interface PublicProfile {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  isActive: boolean;
  acceptingQuestions: boolean;
  anonymousQuestionsEnabled: boolean;
  askPermission: AskPermission;
  showFollowerCounts: boolean;
  showLikeCounts: boolean;
  userDeletedAt: Date | null;
}

export type PublicProfileResolution =
  | {
      status: "active";
      profile: PublicProfile;
    }
  | {
      status: "redirect";
      username: string;
    }
  | {
      status: "unavailable";
      username: string;
    }
  | {
      status: "not_found";
      username: string;
    };

export type PublicProfilePageData =
  | {
      status: "available";
      profile: PublicProfileView;
      ask: PublicAskState;
      askFlash: PublicAskFlash | undefined;
      timingToken: string | undefined;
      publishedAnswers: PublicPublishedAnswer[];
      publishedAnswerControls: PublishedAnswerControlState;
      follow: FollowControlState;
      canReport: boolean;
    }
  | {
      status: "unavailable";
      username: string;
    };

export interface PublicProfileView {
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  askSettings: {
    acceptingQuestions: boolean;
    anonymousQuestionsEnabled: boolean;
    permission: AskPermission;
  };
  counts: {
    answers: number;
    followers: number | undefined;
    following: number | undefined;
    reactions: number | undefined;
  };
}

export interface PublicProfileStore {
  findProfileByUsername(username: string): Promise<PublicProfile | undefined>;
  findViewerFollow?(params: {
    profileId: string;
    viewerProfileId: string;
  }): Promise<boolean>;
  findUsernameReservation(
    username: string,
  ): Promise<PublicUsernameReservation | undefined>;
}

export interface PublicUsernameReservation {
  username: string;
  redirectToUsername: string | null;
  reservedUntil: Date | null;
  redirectUntil: Date | null;
}

export async function resolvePublicProfile({
  username,
  store = createDrizzlePublicProfileStore(),
  now = new Date(),
}: {
  username: string;
  store?: PublicProfileStore | undefined;
  now?: Date | undefined;
}): Promise<PublicProfileResolution> {
  const profile = await store.findProfileByUsername(username);

  if (profile !== undefined) {
    return getProfileResolution(profile, username);
  }

  const reservation = await store.findUsernameReservation(username);

  if (reservation === undefined) {
    return { status: "not_found", username };
  }

  if (hasActiveRedirect(reservation, now)) {
    return {
      status: "redirect",
      username: reservation.redirectToUsername,
    };
  }

  if (isStillReserved(reservation, now)) {
    return { status: "unavailable", username };
  }

  return { status: "not_found", username };
}

export function createPublicProfilePageData({
  askFlash,
  profile,
  publishedAnswerControls = hiddenPublishedAnswerControls,
  session,
  social = emptyPublicProfileSocialStats,
  now = new Date(),
  publishedAnswers = [],
}: {
  askFlash: PublicAskFlash | undefined;
  profile: PublicProfile;
  session: CurrentSessionSummary;
  social?: PublicProfileSocialStats | undefined;
  now?: Date | undefined;
  publishedAnswers?: PublicPublishedAnswer[] | undefined;
  publishedAnswerControls?: PublishedAnswerControlState | undefined;
}): PublicProfilePageData {
  const ask = getPublicAskState({
    actor: session,
    target: {
      ...profile,
      isFollowedByActor: social.isFollowedByViewer,
    },
  });

  return {
    status: "available",
    profile: getPublicProfileView({
      profile,
      publishedAnswers,
      social,
    }),
    ask,
    askFlash,
    timingToken:
      ask.status === "allowed"
        ? createAskTimingToken({
            profileId: profile.id,
            username: profile.username,
            now,
          })
        : undefined,
    publishedAnswers,
    publishedAnswerControls,
    canReport: canSubmitPublicReport(session),
    follow: getFollowControlState({
      isFollowing: social.isFollowedByViewer,
      session,
      target: profile,
    }),
  };
}

function canSubmitPublicReport(session: CurrentSessionSummary) {
  return (
    session.status === "authenticated" &&
    session.profileStatus === "complete" &&
    session.suspensionStatus !== "active"
  );
}

export function createDrizzlePublicProfileStore(
  database: RuntimeDatabase = getRuntimeDatabase(),
): PublicProfileStore {
  return {
    async findProfileByUsername(username) {
      const [profile] = await database
        .select({
          id: profiles.id,
          userId: profiles.userId,
          username: profiles.username,
          displayName: profiles.displayName,
          avatarUrl: profiles.avatarUrl,
          bio: profiles.bio,
          isActive: profiles.isActive,
          acceptingQuestions: profiles.acceptingQuestions,
          anonymousQuestionsEnabled: profiles.anonymousQuestionsEnabled,
          askPermission: profiles.askPermission,
          showFollowerCounts: profiles.showFollowerCounts,
          showLikeCounts: profiles.showLikeCounts,
          userDeletedAt: authUsers.deletedAt,
        })
        .from(profiles)
        .leftJoin(authUsers, eq(authUsers.id, profiles.userId))
        .where(eq(profiles.username, username))
        .limit(1);

      return profile;
    },
    async findViewerFollow({ profileId, viewerProfileId }) {
      const [follow] = await database
        .select({ followedProfileId: follows.followedProfileId })
        .from(follows)
        .where(
          and(
            eq(follows.followerProfileId, viewerProfileId),
            eq(follows.followedProfileId, profileId),
          ),
        )
        .limit(1);

      return follow !== undefined;
    },
    async findUsernameReservation(username) {
      const [reservation] = await database
        .select({
          username: usernameReservations.username,
          redirectToUsername: usernameReservations.redirectToUsername,
          reservedUntil: usernameReservations.reservedUntil,
          redirectUntil: usernameReservations.redirectUntil,
        })
        .from(usernameReservations)
        .where(eq(usernameReservations.username, username))
        .limit(1);

      return reservation;
    },
  };
}

function getProfileResolution(
  profile: PublicProfile,
  username: string,
): PublicProfileResolution {
  if (!profile.isActive || profile.userDeletedAt !== null) {
    return { status: "unavailable", username };
  }

  return {
    status: "active",
    profile,
  };
}

function hasActiveRedirect(
  reservation: PublicUsernameReservation,
  now: Date,
): reservation is PublicUsernameReservation & { redirectToUsername: string } {
  return (
    reservation.redirectToUsername !== null &&
    reservation.redirectUntil !== null &&
    reservation.redirectUntil.getTime() > now.getTime()
  );
}

function isStillReserved(reservation: PublicUsernameReservation, now: Date) {
  return (
    reservation.reservedUntil === null ||
    reservation.reservedUntil.getTime() > now.getTime()
  );
}

function getPublicProfileView({
  profile,
  publishedAnswers,
  social,
}: {
  profile: PublicProfile;
  publishedAnswers: PublicPublishedAnswer[];
  social: PublicProfileSocialStats;
}): PublicProfileView {
  return {
    username: profile.username,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    bio: profile.bio,
    askSettings: {
      acceptingQuestions: profile.acceptingQuestions,
      anonymousQuestionsEnabled: profile.anonymousQuestionsEnabled,
      permission: profile.askPermission,
    },
    counts: {
      answers: publishedAnswers.length,
      followers: profile.showFollowerCounts ? social.followerCount : undefined,
      following: profile.showFollowerCounts ? social.followingCount : undefined,
      reactions: profile.showLikeCounts
        ? sumVisibleLikeCounts(publishedAnswers)
        : undefined,
    },
  };
}

function sumVisibleLikeCounts(publishedAnswers: PublicPublishedAnswer[]) {
  return publishedAnswers.reduce(
    (total, answer) => total + (answer.like.count ?? 0),
    0,
  );
}

const emptyPublicProfileSocialStats = {
  followerCount: 0,
  followingCount: 0,
  isFollowedByViewer: false,
} satisfies PublicProfileSocialStats;
