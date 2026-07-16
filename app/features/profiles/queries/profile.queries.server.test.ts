import { describe, expect, it } from "vitest";

import {
  createPublicProfilePageData,
  resolvePublicProfile,
  type PublicProfile,
  type PublicProfileStore,
  type PublicUsernameReservation
} from "~/features/profiles/queries/profile.queries.server";;
import type {
  PublicPublishedAnswer
} from "~/features/answers/services/answer.service.server";;
import { getPublishedAnswerControlState } from "~/features/answers/services/published-answer-controls.service.server";
import type {
  CompletedProfileSessionSummary,
  CurrentSessionSummary,
  PublicSessionSummary
} from "~/features/auth/services/auth.service.server";;

const now = new Date("2026-05-31T12:00:00.000Z");

describe("resolvePublicProfile", () => {
  it("resolves an active profile", async () => {
    const result = await resolvePublicProfile({
      username: "person",
      store: createProfileStore({
        profiles: [createProfile({ username: "person" })],
      }),
      now,
    });

    expect(result).toMatchObject({
      status: "active",
      profile: {
        username: "person",
      },
    });
  });

  it("redirects an unexpired old username reservation", async () => {
    const result = await resolvePublicProfile({
      username: "old_person",
      store: createProfileStore({
        reservations: [
          {
            username: "old_person",
            redirectToUsername: "person",
            redirectUntil: new Date("2026-06-01T12:00:00.000Z"),
            reservedUntil: new Date("2026-06-01T12:00:00.000Z"),
          },
        ],
      }),
      now,
    });

    expect(result).toEqual({
      status: "redirect",
      username: "person",
    });
  });

  it("returns unavailable for inactive and deleted profiles", async () => {
    await expect(
      resolvePublicProfile({
        username: "inactive",
        store: createProfileStore({
          profiles: [createProfile({ username: "inactive", isActive: false })],
        }),
        now,
      }),
    ).resolves.toEqual({
      status: "unavailable",
      username: "inactive",
    });

    await expect(
      resolvePublicProfile({
        username: "deleted",
        store: createProfileStore({
          profiles: [
            createProfile({
              username: "deleted",
              userDeletedAt: new Date("2026-05-01T12:00:00.000Z"),
            }),
          ],
        }),
        now,
      }),
    ).resolves.toEqual({
      status: "unavailable",
      username: "deleted",
    });
  });

  it("returns unavailable for a still-reserved username", async () => {
    const result = await resolvePublicProfile({
      username: "reserved",
      store: createProfileStore({
        reservations: [
          {
            username: "reserved",
            redirectToUsername: null,
            redirectUntil: null,
            reservedUntil: new Date("2026-06-01T12:00:00.000Z"),
          },
        ],
      }),
      now,
    });

    expect(result).toEqual({
      status: "unavailable",
      username: "reserved",
    });
  });

  it("returns not_found for truly unknown usernames", async () => {
    await expect(
      resolvePublicProfile({
        username: "unknown",
        store: createProfileStore(),
        now,
      }),
    ).resolves.toEqual({
      status: "not_found",
      username: "unknown",
    });
  });
});

describe("createPublicProfilePageData", () => {
  it("does not offer an ask form for a suspended recipient", () => {
    const page = createPublicProfilePageData({
      askFlash: undefined,
      profile: createProfile({ suspensionStatus: "active" }),
      session: anonymousSession,
      now,
    });

    expect(page).toMatchObject({
      status: "available",
      ask: { status: "denied", reason: "questions_closed" },
      timingToken: undefined,
    });
  });

  it("creates an ask-enabled public profile view", () => {
    const page = createPublicProfilePageData({
      askFlash: undefined,
      publishedAnswers: [
        {
          publicId: "titem_1",
          threadPublicId: "thr_1",
          answerText: "Public answer",
          publishedAt: "2026-05-31T12:00:00.000Z",
          pinPosition: null,
          questionTextMode: "hidden",
          questionText: null,
          like: {
            threadItemPublicId: "titem_1",
            isLiked: false,
            count: undefined,
            disabled: true,
          },
          asker: undefined,
        },
      ],
      profile: createProfile({
        showFollowerCounts: false,
        showLikeCounts: false,
      }),
      session: anonymousSession,
      now,
    });

    expect(page).toMatchObject({
      status: "available",
      profile: {
        username: "person",
        askSettings: {
          acceptingQuestions: true,
          anonymousQuestionsEnabled: true,
          permission: "everyone",
        },
        counts: {
          answers: 1,
          followers: undefined,
          following: undefined,
          reactions: undefined,
        },
      },
      ask: {
        status: "allowed",
        defaultIdentity: "anonymous",
      },
      publishedAnswers: [
        expect.objectContaining({
          questionTextMode: "hidden",
          questionText: null,
        }),
      ],
    });
    expect(page.status === "available" ? page.timingToken : undefined).toEqual(
      expect.any(String),
    );
  });

  it("uses aggregate social counts and follow state", () => {
    const page = createPublicProfilePageData({
      askFlash: undefined,
      profile: createProfile(),
      publishedAnswers: [
        createPublishedAnswer({ likeCount: 2, publicId: "titem_1" }),
        createPublishedAnswer({ likeCount: 3, publicId: "titem_2" }),
      ],
      session: {
        ...completedOwnerSession,
        user: {
          ...completedOwnerSession.user,
          id: "user_2",
          email: "follower@example.com",
        },
        profile: {
          ...completedOwnerSession.profile,
          id: "profile_2",
          username: "follower",
        },
      },
      social: {
        followerCount: 7,
        followingCount: 4,
        isFollowedByViewer: true,
      },
      publishedAnswerCount: 27,
      publishedReactionCount: 91,
    });

    expect(page).toMatchObject({
      status: "available",
      profile: {
        counts: {
          answers: 27,
          followers: 7,
          following: 4,
          reactions: 91,
        },
      },
      follow: {
        visible: true,
        isFollowing: true,
        disabled: false,
      },
    });
  });
});

describe("getPublishedAnswerControlState", () => {
  it("allows only the completed-profile owner to manage published answers", () => {
    const profile = createProfile();

    expect(
      getPublishedAnswerControlState({
        owner: profile,
        session: completedOwnerSession,
      }),
    ).toEqual({
      canManage: true,
      disabled: false,
    });
    expect(
      getPublishedAnswerControlState({
        owner: profile,
        session: {
          ...completedOwnerSession,
          suspensionStatus: "active",
        },
      }),
    ).toEqual({
      canManage: true,
      disabled: true,
    });
    expect(
      getPublishedAnswerControlState({
        owner: profile,
        session: anonymousCurrentSession,
      }),
    ).toEqual({
      canManage: false,
      disabled: false,
    });
    expect(
      getPublishedAnswerControlState({
        owner: profile,
        session: incompleteSession,
      }),
    ).toEqual({
      canManage: false,
      disabled: false,
    });
    expect(
      getPublishedAnswerControlState({
        owner: profile,
        session: {
          ...completedOwnerSession,
          profile: { ...completedOwnerSession.profile, id: "profile_other" },
        },
      }),
    ).toEqual({
      canManage: false,
      disabled: false,
    });
  });
});

function createProfileStore({
  profiles = [],
  reservations = [],
}: {
  profiles?: PublicProfile[];
  reservations?: PublicUsernameReservation[];
} = {}): PublicProfileStore {
  return {
    findProfileByUsername(username) {
      return Promise.resolve(
        profiles.find((profile) => profile.username === username),
      );
    },
    findUsernameReservation(username) {
      return Promise.resolve(
        reservations.find((reservation) => reservation.username === username),
      );
    },
  };
}

function createProfile(overrides: Partial<PublicProfile> = {}): PublicProfile {
  return {
    id: "profile_1",
    userId: "user_1",
    username: "person",
    displayName: "Person",
    avatarUrl: null,
    bio: null,
    isActive: true,
    acceptingQuestions: true,
    anonymousQuestionsEnabled: true,
    askPermission: "everyone",
    showFollowerCounts: true,
    showLikeCounts: true,
    userDeletedAt: null,
    suspensionStatus: "none",
    ...overrides,
  };
}

function createPublishedAnswer({
  likeCount,
  publicId,
}: {
  likeCount: number;
  publicId: string;
}) {
  return {
    publicId,
    threadPublicId: "thr_1",
    answerText: "Public answer",
    publishedAt: "2026-05-31T12:00:00.000Z",
    pinPosition: null,
    questionTextMode: "original",
    questionText: "What should I read next?",
    like: {
      threadItemPublicId: publicId,
      isLiked: false,
      count: likeCount,
      disabled: false,
    },
    asker: undefined,
  } satisfies PublicPublishedAnswer;
}

const anonymousSession = {
  status: "anonymous",
} satisfies PublicSessionSummary;

const anonymousCurrentSession = {
  status: "anonymous",
} satisfies CurrentSessionSummary;

const incompleteSession = {
  status: "authenticated",
  profileStatus: "incomplete",
  suspensionStatus: "none",
  user: {
    id: "user_1",
    email: "person@example.com",
    name: "Person",
    image: undefined,
  },
} satisfies CurrentSessionSummary;

const completedOwnerSession = {
  status: "authenticated",
  profileStatus: "complete",
  suspensionStatus: "none",
  user: {
    id: "user_1",
    email: "person@example.com",
    name: "Person",
    image: undefined,
  },
  profile: {
    id: "profile_1",
    username: "person",
    displayName: "Person",
    avatarUrl: null,
  },
} satisfies CompletedProfileSessionSummary;
