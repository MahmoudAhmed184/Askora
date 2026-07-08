import { describe, expect, it } from "vitest";

import type {
  CompletedProfileSessionSummary
} from "~/features/auth/services/auth.service.server";;
import {
  MAX_MUTED_PHRASES_PER_PROFILE,
  loadSafetySettings,
  submitSafetySettings,
  type AcceptingQuestionsUpdate,
  type NewMutedPhrase,
  type SafetySettingsStore,
  type StoredSafetySettings
} from "~/features/settings/services/safety-settings.service.server";;

const now = new Date("2026-05-31T12:00:00.000Z");

describe("loadSafetySettings", () => {
  it("loads owner-scoped safety settings and returns creator-safe block data", async () => {
    const safety = createFakeSafetySettingsStore();

    const view = await loadSafetySettings({
      session: createCompletedSession(),
      store: safety.store,
    });

    expect(safety.findCalls).toEqual([{ profileId: "profile_1", userId: "user_1" }]);
    expect(view).toEqual({
      acceptingQuestions: true,
      mutedPhrases: [
        {
          id: "phrase_1",
          phrase: "Spam",
          createdAt: now.toISOString(),
        },
      ],
      blocks: [
        {
          id: "block_account",
          type: "account",
          profile: {
            displayName: "Asker",
            username: "asker",
          },
          createdAt: now.toISOString(),
        },
        {
          id: "block_account_anonymous",
          type: "account_anonymous",
          createdAt: now.toISOString(),
        },
        {
          id: "block_anonymous",
          type: "anonymous_signal",
          createdAt: now.toISOString(),
        },
      ],
    });
    expect(JSON.stringify(view)).not.toContain("blocked_user_secret");
    expect(JSON.stringify(view)).not.toContain("blocked_profile_secret");
  });
});

describe("submitSafetySettings", () => {
  it("blocks suspended sessions without calling the store", async () => {
    const safety = createFakeSafetySettingsStore();

    const result = await submitSafetySettings({
      formData: createSafetyFormData({ intent: "update_safety" }),
      session: createCompletedSession({ suspensionStatus: "active" }),
      store: safety.store,
      now,
    });

    expect(result.status).toBe("suspended");
    expect(safety.findCalls).toEqual([]);
    expect(safety.acceptingQuestionUpdates).toEqual([]);
  });

  it("updates accepting questions using the session owner only", async () => {
    const safety = createFakeSafetySettingsStore();
    const formData = createSafetyFormData({
      acceptingQuestions: false,
      intent: "update_safety",
    });
    formData.set("profileId", "profile_attacker");
    formData.set("userId", "user_attacker");

    const result = await submitSafetySettings({
      formData,
      session: createCompletedSession(),
      store: safety.store,
      now,
    });

    expect(result).toMatchObject({
      status: "safety_updated",
      values: {
        acceptingQuestions: false,
      },
    });
    expect(safety.acceptingQuestionUpdates).toEqual([
      {
        profileId: "profile_1",
        userId: "user_1",
        acceptingQuestions: false,
        updatedAt: now,
      },
    ]);
  });

  it("adds normalized muted phrases", async () => {
    const safety = createFakeSafetySettingsStore({
      settings: createStoredSafetySettings({ mutedPhrases: [] }),
    });

    const result = await submitSafetySettings({
      createId: () => "phrase_new",
      formData: createSafetyFormData({
        intent: "add_muted_phrase",
        phrase: "  Ｓpam　Text  ",
      }),
      session: createCompletedSession(),
      store: safety.store,
      now,
    });

    expect(result).toMatchObject({
      status: "muted_phrase_added",
      values: {
        phrase: "Spam Text",
      },
    });
    expect(safety.createdMutedPhrases).toEqual([
      {
        id: "phrase_new",
        profileId: "profile_1",
        phrase: "Spam Text",
        normalizedPhrase: "spam text",
        createdAt: now,
        updatedAt: now,
      },
    ]);
  });

  it("handles duplicate muted phrases without writing", async () => {
    const safety = createFakeSafetySettingsStore({
      settings: createStoredSafetySettings({
        mutedPhrases: [
          {
            id: "phrase_1",
            phrase: "Spam text",
            normalizedPhrase: "spam text",
            createdAt: now,
          },
        ],
      }),
    });

    const result = await submitSafetySettings({
      formData: createSafetyFormData({
        intent: "add_muted_phrase",
        phrase: "  Ｓpam   text  ",
      }),
      session: createCompletedSession(),
      store: safety.store,
      now,
    });

    expect(result).toMatchObject({
      status: "muted_phrase_duplicate",
      fieldErrors: {
        phrase: "This phrase is already muted.",
      },
    });
    expect(safety.createdMutedPhrases).toEqual([]);
  });

  it("enforces the 50 muted phrase server limit", async () => {
    const safety = createFakeSafetySettingsStore({
      settings: createStoredSafetySettings({
        mutedPhrases: Array.from(
          { length: MAX_MUTED_PHRASES_PER_PROFILE },
          (_, index) => ({
            id: `phrase_${String(index)}`,
            phrase: `Phrase ${String(index)}`,
            normalizedPhrase: `phrase ${String(index)}`,
            createdAt: now,
          }),
        ),
      }),
    });

    const result = await submitSafetySettings({
      formData: createSafetyFormData({
        intent: "add_muted_phrase",
        phrase: "new phrase",
      }),
      session: createCompletedSession(),
      store: safety.store,
      now,
    });

    expect(result).toMatchObject({
      status: "muted_phrase_limit",
      fieldErrors: {
        phrase: "You can mute up to 50 phrases.",
      },
    });
    expect(safety.createdMutedPhrases).toEqual([]);
  });

  it("removes muted phrases with owner-scoped deletes", async () => {
    const safety = createFakeSafetySettingsStore();
    const formData = createSafetyFormData({
      intent: "remove_muted_phrase",
      mutedPhraseId: "phrase_1",
    });
    formData.set("profileId", "profile_attacker");

    const result = await submitSafetySettings({
      formData,
      session: createCompletedSession(),
      store: safety.store,
      now,
    });

    expect(result.status).toBe("muted_phrase_removed");
    expect(safety.deletedMutedPhrases).toEqual([
      {
        profileId: "profile_1",
        mutedPhraseId: "phrase_1",
      },
    ]);
  });

  it("unblocks senders with owner-scoped deletes", async () => {
    const safety = createFakeSafetySettingsStore();
    const formData = createSafetyFormData({
      blockId: "block_1",
      intent: "unblock_sender",
    });
    formData.set("ownerProfileId", "profile_attacker");
    formData.set("ownerUserId", "user_attacker");

    const result = await submitSafetySettings({
      formData,
      session: createCompletedSession(),
      store: safety.store,
      now,
    });

    expect(result.status).toBe("sender_unblocked");
    expect(safety.deletedBlocks).toEqual([
      {
        ownerProfileId: "profile_1",
        ownerUserId: "user_1",
        blockId: "block_1",
      },
    ]);
  });
});

function createSafetyFormData({
  acceptingQuestions,
  blockId,
  intent,
  mutedPhraseId,
  phrase,
}: {
  acceptingQuestions?: boolean;
  blockId?: string;
  intent:
    | "update_safety"
    | "add_muted_phrase"
    | "remove_muted_phrase"
    | "unblock_sender";
  mutedPhraseId?: string;
  phrase?: string;
}) {
  const formData = new FormData();
  formData.set("intent", intent);

  if (acceptingQuestions === true) {
    formData.set("acceptingQuestions", "on");
  }

  if (phrase !== undefined) {
    formData.set("phrase", phrase);
  }

  if (mutedPhraseId !== undefined) {
    formData.set("mutedPhraseId", mutedPhraseId);
  }

  if (blockId !== undefined) {
    formData.set("blockId", blockId);
  }

  return formData;
}

function createFakeSafetySettingsStore({
  createMutedPhraseResult = "created",
  settings = createStoredSafetySettings(),
}: {
  createMutedPhraseResult?: "created" | "existing";
  settings?: StoredSafetySettings | undefined;
} = {}) {
  const acceptingQuestionUpdates: AcceptingQuestionsUpdate[] = [];
  const createdMutedPhrases: NewMutedPhrase[] = [];
  const deletedBlocks: Parameters<SafetySettingsStore["deleteBlock"]>[0][] = [];
  const deletedMutedPhrases: Parameters<
    SafetySettingsStore["deleteMutedPhrase"]
  >[0][] = [];
  const findCalls: { profileId: string; userId: string }[] = [];

  const store: SafetySettingsStore = {
    findSafetySettings(params) {
      findCalls.push(params);
      return Promise.resolve(settings);
    },
    updateAcceptingQuestions(update) {
      acceptingQuestionUpdates.push(update);
      return Promise.resolve();
    },
    createMutedPhrase(phrase) {
      createdMutedPhrases.push(phrase);
      return Promise.resolve(createMutedPhraseResult);
    },
    deleteMutedPhrase(params) {
      deletedMutedPhrases.push(params);
      return Promise.resolve();
    },
    deleteBlock(params) {
      deletedBlocks.push(params);
      return Promise.resolve();
    },
  };

  return {
    acceptingQuestionUpdates,
    createdMutedPhrases,
    deletedBlocks,
    deletedMutedPhrases,
    findCalls,
    store,
  };
}

function createStoredSafetySettings(
  overrides: Partial<StoredSafetySettings> = {},
): StoredSafetySettings {
  return {
    acceptingQuestions: true,
    mutedPhrases: [
      {
        id: "phrase_1",
        phrase: "Spam",
        normalizedPhrase: "spam",
        createdAt: now,
      },
    ],
    blocks: [
      {
        id: "block_account",
        blockedUserId: "blocked_user_secret",
        blockedProfileId: "blocked_profile_secret",
        blockedProfile: {
          displayName: "Asker",
          username: "asker",
        },
        createdAt: now,
      },
      {
        id: "block_account_anonymous",
        blockedUserId: "blocked_user_secret",
        blockedProfileId: null,
        blockedProfile: undefined,
        createdAt: now,
      },
      {
        id: "block_anonymous",
        blockedUserId: null,
        blockedProfileId: null,
        blockedProfile: undefined,
        createdAt: now,
      },
    ],
    ...overrides,
  };
}

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
