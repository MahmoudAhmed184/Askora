import { describe, expect, it } from "vitest";

import type { CompletedProfileSessionSummary } from "~/features/auth/auth.server";
import {
  loadPrivacySettings,
  submitPrivacySettings,
  type PrivacySettingsStore,
  type PrivacySettingsUpdate,
  type StoredPrivacySettings,
} from "~/features/settings/privacy-settings.server";

const now = new Date("2026-05-31T12:00:00.000Z");

describe("loadPrivacySettings", () => {
  it("loads settings for the completed session owner", async () => {
    const privacySettings = createFakePrivacySettingsStore();

    await loadPrivacySettings({
      session: createCompletedSession(),
      store: privacySettings.store,
    });

    expect(privacySettings.findCalls).toEqual([
      { profileId: "profile_1", userId: "user_1" },
    ]);
  });
});

describe("submitPrivacySettings", () => {
  it("blocks suspended sessions without calling the store", async () => {
    const privacySettings = createFakePrivacySettingsStore();

    const result = await submitPrivacySettings({
      formData: createPrivacySettingsFormData(),
      session: createCompletedSession({ suspensionStatus: "active" }),
      store: privacySettings.store,
      now,
    });

    expect(result.status).toBe("suspended");
    expect(privacySettings.findCalls).toEqual([]);
    expect(privacySettings.updates).toEqual([]);
  });

  it("ignores form-supplied owner IDs and treats unchecked boxes as false", async () => {
    const privacySettings = createFakePrivacySettingsStore();
    const formData = createPrivacySettingsFormData({
      askPermission: "logged_in",
      followUpPermissionDefault: "original_asker",
    });
    formData.set("profileId", "profile_attacker");
    formData.set("userId", "user_attacker");

    const result = await submitPrivacySettings({
      formData,
      session: createCompletedSession(),
      store: privacySettings.store,
      now,
    });

    expect(result.status).toBe("updated");
    expect(privacySettings.updates).toEqual([
      {
        profileId: "profile_1",
        userId: "user_1",
        updatedAt: now,
        anonymousQuestionsEnabled: false,
        askPermission: "logged_in",
        followUpPermissionDefault: "original_asker",
        showFollowerCounts: false,
        showLikeCounts: false,
      },
    ]);
  });

  it("updates follower and reaction count visibility independently", async () => {
    const privacySettings = createFakePrivacySettingsStore();

    const result = await submitPrivacySettings({
      formData: createPrivacySettingsFormData({
        anonymousQuestionsEnabled: true,
        askPermission: "everyone",
        followUpPermissionDefault: "anyone",
        showFollowerCounts: true,
        showLikeCounts: false,
      }),
      session: createCompletedSession(),
      store: privacySettings.store,
      now,
    });

    expect(result.status).toBe("updated");
    expect(privacySettings.updates[0]).toMatchObject({
      anonymousQuestionsEnabled: true,
      showFollowerCounts: true,
      showLikeCounts: false,
    });
  });

  it("returns field errors for invalid enums before loading the store", async () => {
    const privacySettings = createFakePrivacySettingsStore();
    const formData = new FormData();
    formData.set("askPermission", "friends");
    formData.set("followUpPermissionDefault", "anyone");

    const result = await submitPrivacySettings({
      formData,
      session: createCompletedSession(),
      store: privacySettings.store,
      now,
    });

    expect(result).toMatchObject({
      status: "invalid",
      fieldErrors: {
        askPermission: "Choose who can ask questions.",
      },
    });
    expect(privacySettings.findCalls).toEqual([]);
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
      image: undefined,
    },
    profile: {
      id: "profile_1",
      username: "person",
      displayName: "Person",
      avatarUrl: null,
    },
    ...overrides,
  };
}

function createPrivacySettingsFormData(
  values: Partial<{
    anonymousQuestionsEnabled: boolean;
    askPermission: StoredPrivacySettings["askPermission"];
    followUpPermissionDefault: StoredPrivacySettings["followUpPermissionDefault"];
    showFollowerCounts: boolean;
    showLikeCounts: boolean;
  }> = {},
) {
  const formData = new FormData();

  if (values.anonymousQuestionsEnabled === true) {
    formData.set("anonymousQuestionsEnabled", "on");
  }

  formData.set("askPermission", values.askPermission ?? "everyone");
  formData.set(
    "followUpPermissionDefault",
    values.followUpPermissionDefault ?? "anyone",
  );

  if (values.showFollowerCounts === true) {
    formData.set("showFollowerCounts", "on");
  }

  if (values.showLikeCounts === true) {
    formData.set("showLikeCounts", "on");
  }

  return formData;
}

function createFakePrivacySettingsStore({
  settings = createStoredPrivacySettings(),
}: {
  settings?: StoredPrivacySettings | undefined;
} = {}) {
  const findCalls: { profileId: string; userId: string }[] = [];
  const updates: PrivacySettingsUpdate[] = [];

  const store: PrivacySettingsStore = {
    findPrivacySettings(params) {
      findCalls.push(params);
      return Promise.resolve(settings);
    },
    updatePrivacySettings(update) {
      updates.push(update);
      return Promise.resolve();
    },
  };

  return {
    findCalls,
    store,
    updates,
  };
}

function createStoredPrivacySettings(): StoredPrivacySettings {
  return {
    anonymousQuestionsEnabled: true,
    askPermission: "everyone",
    followUpPermissionDefault: "anyone",
    showFollowerCounts: true,
    showLikeCounts: true,
  };
}
