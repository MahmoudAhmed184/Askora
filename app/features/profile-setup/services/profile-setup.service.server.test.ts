import { describe, expect, it } from "vitest";

import type {
  IncompleteProfileSessionSummary
} from "~/features/auth/services/auth.service.server";;
import {
  createCanonicalProfileUrl,
  getProfileSetupDefaults,
  submitProfileSetup,
  type ExistingProfile,
  type ExistingUsernameReservation,
  type NewProfileSetup,
  type ProfileSetupStore
} from "~/features/profile-setup/services/profile-setup.service.server";;

describe("submitProfileSetup", () => {
  it("blocks suspended incomplete-profile users", async () => {
    const profileSetup = createFakeProfileSetupStore();

    const result = await submitProfileSetup({
      formData: createProfileSetupFormData(),
      session: createIncompleteSession({ suspensionStatus: "active" }),
      store: profileSetup.store,
    });

    expect(result.status).toBe("suspended");
    expect(profileSetup.createdSetups).toEqual([]);
  });

  it("returns duplicate-profile when the account already has a profile", async () => {
    const profileSetup = createFakeProfileSetupStore({
      existingProfile: { id: "profile_existing", username: "existing" },
    });

    const result = await submitProfileSetup({
      formData: createProfileSetupFormData(),
      session: createIncompleteSession(),
      store: profileSetup.store,
    });

    expect(result.status).toBe("duplicate_profile");
    expect(profileSetup.createdSetups).toEqual([]);
  });

  it("returns a username field error when the username is reserved", async () => {
    const profileSetup = createFakeProfileSetupStore({
      usernameReservation: { id: "reservation_existing", profileId: "profile_2" },
    });

    const result = await submitProfileSetup({
      formData: createProfileSetupFormData({ username: "creator_1" }),
      session: createIncompleteSession(),
      store: profileSetup.store,
    });

    expect(result).toMatchObject({
      status: "username_taken",
      fieldErrors: {
        username: "This username is not available.",
      },
    });
  });

  it("creates the profile, active reservation, and setup event atomically", async () => {
    const profileSetup = createFakeProfileSetupStore();

    const result = await submitProfileSetup({
      formData: createProfileSetupFormData({
        username: " creator_1 ",
        displayName: " Person ",
        bio: " Hello there ",
      }),
      session: createIncompleteSession(),
      store: profileSetup.store,
      createId: createIdSequence(["profile_1", "reservation_1", "event_1"]),
    });

    expect(result).toEqual({
      status: "created",
      profile: {
        id: "profile_1",
        username: "creator_1",
        displayName: "Person",
      },
    });
    expect(profileSetup.createdSetups).toEqual([
      {
        profileId: "profile_1",
        reservationId: "reservation_1",
        eventId: "event_1",
        userId: "user_1",
        username: "creator_1",
        displayName: "Person",
        avatarUrl: "https://cdn.example.com/avatar.png",
        bio: "Hello there",
      },
    ]);
  });

  it("maps username unique-constraint races to a username field error", async () => {
    const profileSetup = createFakeProfileSetupStore({
      createError: createUniqueConstraintError(
        "username_reservations_username_unique",
      ),
    });

    const result = await submitProfileSetup({
      formData: createProfileSetupFormData(),
      session: createIncompleteSession(),
      store: profileSetup.store,
    });

    expect(result.status).toBe("username_taken");
  });

  it("maps profile unique-constraint races to duplicate-profile", async () => {
    const profileSetup = createFakeProfileSetupStore({
      createError: createUniqueConstraintError("profiles_user_id_unique"),
    });

    const result = await submitProfileSetup({
      formData: createProfileSetupFormData(),
      session: createIncompleteSession(),
      store: profileSetup.store,
    });

    expect(result.status).toBe("duplicate_profile");
  });
});

describe("profile setup helpers", () => {
  it("builds form defaults from auth name and email local-part", () => {
    expect(
      getProfileSetupDefaults({
        email: "person@example.com",
        name: " Person Example ",
      }),
    ).toEqual({
      username: "person",
      displayName: "Person Example",
      bio: "",
    });
  });

  it("generates canonical profile URLs from APP_URL", () => {
    expect(createCanonicalProfileUrl("https://app.example.com/", "person")).toBe(
      "https://app.example.com/person",
    );
  });
});

function createIncompleteSession(
  overrides: Partial<IncompleteProfileSessionSummary> = {},
): IncompleteProfileSessionSummary {
  return {
    status: "authenticated",
    profileStatus: "incomplete",
    suspensionStatus: "none",
    user: {
      id: "user_1",
      email: "person@example.com",
      name: "Person Example",
      image: "https://cdn.example.com/avatar.png",
    },
    ...overrides,
  };
}

function createProfileSetupFormData(
  values: Partial<{
    username: string;
    displayName: string;
    bio: string;
  }> = {},
) {
  const formData = new FormData();

  formData.set("username", values.username ?? "creator_1");
  formData.set("displayName", values.displayName ?? "Person");
  formData.set("bio", values.bio ?? "");

  return formData;
}

function createFakeProfileSetupStore({
  existingProfile,
  activeUsernameProfile,
  usernameReservation,
  createError,
}: {
  existingProfile?: ExistingProfile;
  activeUsernameProfile?: ExistingProfile;
  usernameReservation?: ExistingUsernameReservation;
  createError?: Error;
} = {}) {
  const createdSetups: NewProfileSetup[] = [];

  const store: ProfileSetupStore = {
    findProfileByUserId() {
      return Promise.resolve(existingProfile);
    },
    findActiveProfileByUsername() {
      return Promise.resolve(activeUsernameProfile);
    },
    findUsernameReservation() {
      return Promise.resolve(usernameReservation);
    },
    createProfileSetup(setup) {
      if (createError !== undefined) {
        throw createError;
      }

      createdSetups.push(setup);
      return Promise.resolve();
    },
  };

  return {
    createdSetups,
    store,
  };
}

function createIdSequence(ids: string[]) {
  return () => ids.shift() ?? "extra_id";
}

function createUniqueConstraintError(constraint: string) {
  return Object.assign(new Error(`duplicate key violates ${constraint}`), {
    code: "23505",
    constraint,
  });
}
