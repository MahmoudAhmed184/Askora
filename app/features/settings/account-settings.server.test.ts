import { describe, expect, it } from "vitest";

import type { CompletedProfileSessionSummary } from "~/features/auth/auth.server";
import {
  ACCOUNT_DELETION_GRACE_DAYS,
  loadAccountSettings,
  submitAccountSettings,
  type AccountDeletionRequestParams,
  type AccountMutationParams,
  type AccountMutationStoreResult,
  type AccountSettingsStore,
  type StoredAccountSettings,
} from "~/features/settings/account-settings.server";

const now = new Date("2026-05-31T12:00:00.000Z");

describe("loadAccountSettings", () => {
  it("loads account lifecycle state for the completed session owner", async () => {
    const accountSettings = createFakeAccountSettingsStore();

    const settings = await loadAccountSettings({
      session: createCompletedSession(),
      store: accountSettings.store,
    });

    expect(accountSettings.findCalls).toEqual([
      { profileId: "profile_1", userId: "user_1" },
    ]);
    expect(settings).toMatchObject({
      profile: {
        username: "person",
        isActive: true,
      },
      deletion: {
        status: "none",
      },
      deletionGraceDays: ACCOUNT_DELETION_GRACE_DAYS,
    });
  });
});

describe("submitAccountSettings", () => {
  it("deactivates the profile without trusting form-supplied owner IDs", async () => {
    const accountSettings = createFakeAccountSettingsStore();
    const formData = createAccountFormData({
      intent: "deactivate",
      confirmation: "DEACTIVATE",
    });
    formData.set("profileId", "profile_attacker");
    formData.set("userId", "user_attacker");

    const result = await submitAccountSettings({
      formData,
      now,
      session: createCompletedSession(),
      store: accountSettings.store,
    });

    expect(result.status).toBe("deactivated");
    expect(accountSettings.deactivations).toEqual([
      { profileId: "profile_1", userId: "user_1", now },
    ]);
    expect(accountSettings.settings).toMatchObject({
      isActive: false,
      deactivatedAt: now,
      deactivationReason: "user",
    });
  });

  it("reactivates only user-deactivated profiles with no pending deletion", async () => {
    const accountSettings = createFakeAccountSettingsStore({
      settings: createStoredAccountSettings({
        isActive: false,
        deactivatedAt: new Date("2026-05-15T12:00:00.000Z"),
        deactivationReason: "user",
      }),
    });

    const result = await submitAccountSettings({
      formData: createAccountFormData({ intent: "reactivate" }),
      now,
      session: createCompletedSession(),
      store: accountSettings.store,
    });

    expect(result.status).toBe("reactivated");
    expect(accountSettings.reactivations).toEqual([
      { profileId: "profile_1", userId: "user_1", now },
    ]);
    expect(accountSettings.settings).toMatchObject({
      isActive: true,
      deactivatedAt: null,
      deactivationReason: null,
    });
  });

  it("does not reactivate admin-hidden, pending-deletion, or suspended profiles", async () => {
    const adminHidden = createFakeAccountSettingsStore({
      settings: createStoredAccountSettings({
        isActive: false,
        deactivatedAt: now,
        deactivationReason: "admin",
      }),
    });

    await expect(
      submitAccountSettings({
        formData: createAccountFormData({ intent: "reactivate" }),
        now,
        session: createCompletedSession(),
        store: adminHidden.store,
      }),
    ).resolves.toMatchObject({ status: "not_user_deactivated" });
    expect(adminHidden.settings).toMatchObject({ isActive: false });

    const pendingDeletion = createFakeAccountSettingsStore({
      settings: createStoredAccountSettings({
        deletedAt: now,
        deletionGraceEndsAt: new Date("2026-06-14T12:00:00.000Z"),
        isActive: false,
        deactivatedAt: now,
        deactivationReason: "account_deletion",
      }),
    });

    await expect(
      submitAccountSettings({
        formData: createAccountFormData({ intent: "reactivate" }),
        now,
        session: createCompletedSession(),
        store: pendingDeletion.store,
      }),
    ).resolves.toMatchObject({ status: "pending_deletion" });
    expect(pendingDeletion.settings).toMatchObject({ isActive: false });

    const suspended = createFakeAccountSettingsStore({
      settings: createStoredAccountSettings({
        isActive: false,
        deactivatedAt: now,
        deactivationReason: "user",
      }),
    });

    await expect(
      submitAccountSettings({
        formData: createAccountFormData({ intent: "reactivate" }),
        now,
        session: createCompletedSession({ suspensionStatus: "active" }),
        store: suspended.store,
      }),
    ).resolves.toMatchObject({ status: "suspended" });
    expect(suspended.reactivations).toEqual([]);
  });

  it("requests deletion with a 14-day grace period and deactivates immediately", async () => {
    const accountSettings = createFakeAccountSettingsStore();

    const result = await submitAccountSettings({
      formData: createAccountFormData({
        intent: "request_deletion",
        confirmation: "DELETE",
      }),
      now,
      session: createCompletedSession({ suspensionStatus: "active" }),
      store: accountSettings.store,
    });

    expect(result.status).toBe("deletion_requested");
    expect(accountSettings.deletionRequests).toEqual([
      {
        profileId: "profile_1",
        userId: "user_1",
        now,
        deletionGraceEndsAt: new Date("2026-06-14T12:00:00.000Z"),
      },
    ]);
    expect(accountSettings.settings).toMatchObject({
      deletedAt: now,
      deletionGraceEndsAt: new Date("2026-06-14T12:00:00.000Z"),
      deletionAnonymizedAt: null,
      isActive: false,
      deactivatedAt: now,
      deactivationReason: "account_deletion",
    });
  });

  it("cancels pending deletion without reactivating the profile", async () => {
    const accountSettings = createFakeAccountSettingsStore({
      settings: createStoredAccountSettings({
        deletedAt: new Date("2026-05-20T12:00:00.000Z"),
        deletionGraceEndsAt: new Date("2026-06-03T12:00:00.000Z"),
        isActive: false,
        deactivatedAt: new Date("2026-05-20T12:00:00.000Z"),
        deactivationReason: "account_deletion",
      }),
    });

    const result = await submitAccountSettings({
      formData: createAccountFormData({ intent: "cancel_deletion" }),
      now,
      session: createCompletedSession({ suspensionStatus: "active" }),
      store: accountSettings.store,
    });

    expect(result.status).toBe("deletion_cancelled");
    expect(accountSettings.cancellations).toEqual([
      { profileId: "profile_1", userId: "user_1", now },
    ]);
    expect(accountSettings.settings).toMatchObject({
      deletedAt: null,
      deletionGraceEndsAt: null,
      deletionAnonymizedAt: null,
      isActive: false,
      deactivatedAt: now,
      deactivationReason: "user",
    });
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

function createStoredAccountSettings(
  overrides: Partial<StoredAccountSettings> = {},
): StoredAccountSettings {
  return {
    userId: "user_1",
    email: "person@example.com",
    name: "Person",
    deletedAt: null,
    deletionGraceEndsAt: null,
    deletionAnonymizedAt: null,
    profileId: "profile_1",
    profileUserId: "user_1",
    username: "person",
    displayName: "Person",
    isActive: true,
    deactivatedAt: null,
    deactivationReason: null,
    ...overrides,
  };
}

function createAccountFormData({
  confirmation = "",
  intent,
}: {
  intent: "deactivate" | "reactivate" | "request_deletion" | "cancel_deletion";
  confirmation?: string;
}) {
  const formData = new FormData();

  formData.set("intent", intent);
  formData.set("confirmation", confirmation);

  return formData;
}

function createFakeAccountSettingsStore({
  settings = createStoredAccountSettings(),
}: {
  settings?: StoredAccountSettings | undefined;
} = {}) {
  const state: { settings: StoredAccountSettings | undefined } = { settings };
  const findCalls: { profileId: string; userId: string }[] = [];
  const deactivations: AccountMutationParams[] = [];
  const reactivations: AccountMutationParams[] = [];
  const deletionRequests: AccountDeletionRequestParams[] = [];
  const cancellations: AccountMutationParams[] = [];

  const store: AccountSettingsStore = {
    findAccountSettings(params) {
      findCalls.push(params);
      return Promise.resolve(state.settings);
    },
    deactivateProfile(params) {
      deactivations.push(params);
      if (state.settings === undefined) {
        return Promise.resolve({ status: "not_found" });
      }

      state.settings = {
        ...state.settings,
        isActive: false,
        deactivatedAt: params.now,
        deactivationReason: "user",
      };

      return Promise.resolve({ status: "updated" });
    },
    reactivateProfile(params) {
      reactivations.push(params);

      if (state.settings === undefined) {
        return Promise.resolve({ status: "not_found" });
      }

      const result = getReactivateResult(state.settings);

      if (result.status !== "updated") {
        return Promise.resolve(result);
      }

      state.settings = {
        ...state.settings,
        isActive: true,
        deactivatedAt: null,
        deactivationReason: null,
      };

      return Promise.resolve(result);
    },
    requestAccountDeletion(params) {
      deletionRequests.push(params);

      if (state.settings === undefined) {
        return Promise.resolve({ status: "not_found" });
      }

      state.settings = {
        ...state.settings,
        deletedAt: params.now,
        deletionGraceEndsAt: params.deletionGraceEndsAt,
        deletionAnonymizedAt: null,
        isActive: false,
        deactivatedAt: params.now,
        deactivationReason: "account_deletion",
      };

      return Promise.resolve({ status: "updated" });
    },
    cancelAccountDeletion(params) {
      cancellations.push(params);

      if (state.settings === undefined) {
        return Promise.resolve({ status: "not_found" });
      }

      if (state.settings.deletedAt === null) {
        return Promise.resolve({ status: "no_pending_deletion" });
      }

      state.settings = {
        ...state.settings,
        deletedAt: null,
        deletionGraceEndsAt: null,
        deletionAnonymizedAt: null,
        isActive: false,
        deactivatedAt: params.now,
        deactivationReason: "user",
      };

      return Promise.resolve({ status: "updated" });
    },
  };

  return {
    cancellations,
    deactivations,
    deletionRequests,
    findCalls,
    reactivations,
    store,
    get settings() {
      return state.settings;
    },
  };
}

function getReactivateResult(
  settings: StoredAccountSettings,
): AccountMutationStoreResult {
  if (settings.deletionAnonymizedAt !== null) {
    return { status: "deletion_completed" };
  }

  if (settings.deletedAt !== null) {
    return { status: "pending_deletion" };
  }

  if (
    settings.isActive ||
    settings.deactivationReason !== "user" ||
    settings.deactivatedAt === null
  ) {
    return { status: "not_user_deactivated" };
  }

  return { status: "updated" };
}
