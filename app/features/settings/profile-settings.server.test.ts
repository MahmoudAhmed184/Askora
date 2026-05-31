import { describe, expect, it } from "vitest";

import type { CompletedProfileSessionSummary } from "~/features/auth/auth.server";
import {
  loadProfileSettings,
  submitProfileSettings,
  type ExistingProfileUsername,
  type ExistingUsernameReservation,
  type ProfileIdentityUpdate,
  type ProfileSettingsStore,
  type ProfileUsernameChange,
  type ProfileUsernameChangeStoreResult,
  type StoredProfileSettings,
} from "~/features/settings/profile-settings.server";

const now = new Date("2026-05-31T12:00:00.000Z");

describe("loadProfileSettings", () => {
  it("loads settings for the completed session owner", async () => {
    const profileSettings = createFakeProfileSettingsStore();

    const settings = await loadProfileSettings({
      session: createCompletedSession(),
      store: profileSettings.store,
      now,
    });

    expect(profileSettings.findProfileCalls).toEqual([
      { profileId: "profile_1", userId: "user_1" },
    ]);
    expect(settings.values).toMatchObject({
      username: "person",
      displayName: "Person",
      bio: "Hello",
      avatarSource: "google",
    });
    expect(settings.usernameCooldown?.nextChangeDate).toBe("2026-04-01");
  });
});

describe("submitProfileSettings", () => {
  it("blocks suspended sessions without calling the store", async () => {
    const profileSettings = createFakeProfileSettingsStore();

    const result = await submitProfileSettings({
      formData: createProfileSettingsFormData({ username: "new_person" }),
      session: createCompletedSession({ suspensionStatus: "active" }),
      store: profileSettings.store,
      now,
    });

    expect(result.status).toBe("suspended");
    expect(profileSettings.findProfileCalls).toEqual([]);
    expect(profileSettings.updates).toEqual([]);
    expect(profileSettings.usernameChanges).toEqual([]);
  });

  it("ignores form-supplied owner IDs and updates the session profile", async () => {
    const profileSettings = createFakeProfileSettingsStore({
      profile: createStoredProfile({
        activeUsernameReservation: {
          id: "reservation_1",
          createdAt: now,
        },
      }),
    });
    const formData = createProfileSettingsFormData({
      username: "person",
      displayName: "Updated Person",
      bio: "Updated bio",
      avatarSource: "google",
    });
    formData.set("profileId", "profile_attacker");
    formData.set("userId", "user_attacker");

    const result = await submitProfileSettings({
      formData,
      session: createCompletedSession(),
      store: profileSettings.store,
      now,
    });

    expect(result.status).toBe("updated");
    expect(profileSettings.updates).toEqual([
      {
        profileId: "profile_1",
        userId: "user_1",
        displayName: "Updated Person",
        bio: "Updated bio",
        avatarUrl: "https://cdn.example.com/avatar.png",
        updatedAt: now,
      },
    ]);
    expect(profileSettings.activeProfileLookups).toEqual([]);
    expect(profileSettings.reservationLookups).toEqual([]);
  });

  it("lets unchanged usernames bypass active cooldown", async () => {
    const profileSettings = createFakeProfileSettingsStore({
      profile: createStoredProfile({
        activeUsernameReservation: {
          id: "reservation_1",
          createdAt: now,
        },
      }),
    });

    const result = await submitProfileSettings({
      formData: createProfileSettingsFormData({
        username: "person",
        displayName: "Person",
      }),
      session: createCompletedSession(),
      store: profileSettings.store,
      now,
    });

    expect(result).toMatchObject({
      status: "updated",
      usernameChanged: false,
    });
    expect(profileSettings.updates).toHaveLength(1);
    expect(profileSettings.usernameChanges).toEqual([]);
  });

  it("enforces username cooldown for changed usernames", async () => {
    const profileSettings = createFakeProfileSettingsStore({
      profile: createStoredProfile({
        activeUsernameReservation: {
          id: "reservation_1",
          createdAt: new Date("2026-05-15T12:00:00.000Z"),
        },
      }),
    });

    const result = await submitProfileSettings({
      formData: createProfileSettingsFormData({ username: "new_person" }),
      session: createCompletedSession(),
      store: profileSettings.store,
      now,
    });

    expect(result).toMatchObject({
      status: "cooldown",
      fieldErrors: {
        username: "You can change your username again on 2026-06-14.",
      },
    });
    expect(profileSettings.activeProfileLookups).toEqual([]);
    expect(profileSettings.usernameChanges).toEqual([]);
  });

  it("returns a username error for active profile conflicts", async () => {
    const profileSettings = createFakeProfileSettingsStore({
      activeUsernameProfile: { id: "profile_2", username: "new_person" },
    });

    const result = await submitProfileSettings({
      formData: createProfileSettingsFormData({ username: "new_person" }),
      session: createCompletedSession(),
      store: profileSettings.store,
      now,
    });

    expect(result).toMatchObject({
      status: "username_taken",
      fieldErrors: {
        username: "This username is not available.",
      },
    });
    expect(profileSettings.usernameChanges).toEqual([]);
  });

  it("returns a username error for reservation conflicts", async () => {
    const profileSettings = createFakeProfileSettingsStore({
      usernameReservation: { id: "reservation_2", profileId: "profile_2" },
    });

    const result = await submitProfileSettings({
      formData: createProfileSettingsFormData({ username: "new_person" }),
      session: createCompletedSession(),
      store: profileSettings.store,
      now,
    });

    expect(result.status).toBe("username_taken");
    expect(profileSettings.usernameChanges).toEqual([]);
  });

  it("changes usernames through the atomic store path", async () => {
    const profileSettings = createFakeProfileSettingsStore();

    const result = await submitProfileSettings({
      formData: createProfileSettingsFormData({
        username: "new_person",
        displayName: "New Person",
        avatarSource: "fallback",
      }),
      session: createCompletedSession(),
      store: profileSettings.store,
      createId: () => "reservation_new",
      now,
    });

    expect(result).toEqual({
      status: "updated",
      values: {
        username: "new_person",
        displayName: "New Person",
        bio: "",
        avatarSource: "fallback",
      },
      usernameChanged: true,
      previousUsername: "person",
      redirectUntilDate: "2026-08-29",
    });
    expect(profileSettings.updates).toEqual([]);
    expect(profileSettings.usernameChanges).toEqual([
      {
        profileId: "profile_1",
        userId: "user_1",
        previousUsername: "person",
        newUsername: "new_person",
        newReservationId: "reservation_new",
        displayName: "New Person",
        bio: undefined,
        avatarUrl: null,
        updatedAt: now,
        oldUsernameReservedUntil: new Date("2026-08-29T12:00:00.000Z"),
        oldUsernameRedirectUntil: new Date("2026-08-29T12:00:00.000Z"),
      },
    ]);
  });
});

function createCompletedSession(
  overrides: Partial<CompletedProfileSessionSummary> = {},
): CompletedProfileSessionSummary {
  return {
    status: "authenticated",
    profileStatus: "complete",
    suspensionStatus: "none",
    user: {
      id: "user_1",
      email: "person@example.com",
      name: "Person",
      image: "https://cdn.example.com/avatar.png",
    },
    profile: {
      id: "profile_1",
      username: "person",
      displayName: "Person",
      avatarUrl: "https://cdn.example.com/avatar.png",
    },
    ...overrides,
  };
}

function createStoredProfile(
  overrides: Partial<StoredProfileSettings> = {},
): StoredProfileSettings {
  return {
    id: "profile_1",
    userId: "user_1",
    username: "person",
    displayName: "Person",
    avatarUrl: "https://cdn.example.com/avatar.png",
    bio: "Hello",
    activeUsernameReservation: {
      id: "reservation_1",
      createdAt: new Date("2026-03-02T12:00:00.000Z"),
    },
    ...overrides,
  };
}

function createProfileSettingsFormData(
  values: Partial<{
    username: string;
    displayName: string;
    bio: string;
    avatarSource: "google" | "fallback";
  }> = {},
) {
  const formData = new FormData();

  formData.set("username", values.username ?? "person");
  formData.set("displayName", values.displayName ?? "Person");
  formData.set("bio", values.bio ?? "");
  formData.set("avatarSource", values.avatarSource ?? "fallback");

  return formData;
}

function createFakeProfileSettingsStore({
  profile = createStoredProfile(),
  activeUsernameProfile,
  usernameReservation,
  changeResult = { status: "changed" },
}: {
  profile?: StoredProfileSettings | undefined;
  activeUsernameProfile?: ExistingProfileUsername;
  usernameReservation?: ExistingUsernameReservation;
  changeResult?: ProfileUsernameChangeStoreResult;
} = {}) {
  const findProfileCalls: { profileId: string; userId: string }[] = [];
  const activeProfileLookups: string[] = [];
  const reservationLookups: string[] = [];
  const updates: ProfileIdentityUpdate[] = [];
  const usernameChanges: ProfileUsernameChange[] = [];

  const store: ProfileSettingsStore = {
    findProfileSettings(params) {
      findProfileCalls.push(params);
      return Promise.resolve(profile);
    },
    findActiveProfileByUsername(username) {
      activeProfileLookups.push(username);
      return Promise.resolve(activeUsernameProfile);
    },
    findUsernameReservation(username) {
      reservationLookups.push(username);
      return Promise.resolve(usernameReservation);
    },
    updateProfileIdentity(update) {
      updates.push(update);
      return Promise.resolve();
    },
    changeProfileUsername(change) {
      usernameChanges.push(change);
      return Promise.resolve(changeResult);
    },
  };

  return {
    activeProfileLookups,
    findProfileCalls,
    reservationLookups,
    store,
    updates,
    usernameChanges,
  };
}
