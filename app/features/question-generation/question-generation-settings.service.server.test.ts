import { describe, expect, it } from "vitest";

import type { CompletedProfileSessionSummary } from "~/features/auth/services/auth.service.server";
import {
  getQuestionGenerationCredential,
  loadQuestionGenerationSettings,
  submitQuestionGenerationSettings,
} from "~/features/question-generation/question-generation-settings.service.server";
import type {
  QuestionGenerationSettingsRepository,
  StoredQuestionGenerationSettings,
} from "~/features/question-generation/question-generation.repository.server";

const now = new Date("2026-08-05T12:00:00.000Z");

describe("question generation settings", () => {
  it("validates a key before atomically storing encrypted material", async () => {
    const stores = createRepository();
    const validationInputs: unknown[] = [];
    const result = await submitQuestionGenerationSettings({
      formData: createFormData({
        intent: "connect",
        geminiApiKey: "test-key-not-to-store",
        modelPreference: "gemini-3.1-flash-lite",
      }),
      encryptCredential: () => credentialMaterial,
      now,
      repository: stores.repository,
      session,
      validateCredential: (input) => {
        validationInputs.push(input);
        return Promise.resolve({ status: "validated" } as const);
      },
    });

    expect(validationInputs).toEqual([
      { apiKey: "test-key-not-to-store", model: "gemini-3.1-flash-lite" },
    ]);
    expect(result.status).toBe("credential_connected");
    expect(stores.savedCredentials).toHaveLength(1);
    expect(stores.savedCredentials[0]).toMatchObject({
      action: "credential_connected",
      material: credentialMaterial,
      ownerUserId: session.user.id,
    });
    expect(JSON.stringify(result)).not.toContain("test-key-not-to-store");
    expect(JSON.stringify(await loadQuestionGenerationSettings({ repository: stores.repository, session }))).not.toContain(
      credentialMaterial.ciphertext,
    );
  });

  it("does not replace an existing credential when validation fails", async () => {
    const stores = createRepository({ settings: connectedSettings });
    const result = await submitQuestionGenerationSettings({
      formData: createFormData({
        intent: "connect",
        geminiApiKey: "test-key-not-to-store",
        modelPreference: "auto",
      }),
      encryptCredential: () => credentialMaterial,
      now,
      repository: stores.repository,
      session,
      validateCredential: () =>
        Promise.resolve({ status: "failed", reason: "invalid_credential" } as const),
    });

    expect(result).toMatchObject({ status: "credential_invalid" });
    expect(stores.savedCredentials).toEqual([]);
    expect(stores.events).toEqual([
      { action: "credential_replaced", outcome: "failure" },
    ]);
  });

  it("uses a separate conservative rate limit before validation", async () => {
    const stores = createRepository();
    let validated = false;
    const result = await submitQuestionGenerationSettings({
      formData: createFormData({
        intent: "connect",
        geminiApiKey: "test-key-not-to-store",
        modelPreference: "auto",
      }),
      encryptCredential: () => credentialMaterial,
      now,
      rateLimiter: () => Promise.resolve({ allowed: false, retryAfterSeconds: 30 }),
      repository: stores.repository,
      session,
      validateCredential: () => {
        validated = true;
        return Promise.resolve({ status: "validated" } as const);
      },
    });

    expect(result).toMatchObject({ status: "rate_limited", retryAfterSeconds: 30 });
    expect(validated).toBe(false);
  });

  it("saves validated private preferences and disclosure acknowledgement", async () => {
    const stores = createRepository();
    const preferences = await submitQuestionGenerationSettings({
      formData: createFormData({
        intent: "save_preferences",
        modelPreference: "auto",
        questionInterests: "Books\nSoftware engineering",
      }),
      now,
      repository: stores.repository,
      session,
    });
    const disclosure = await submitQuestionGenerationSettings({
      formData: createFormData({
        intent: "acknowledge_disclosure",
        acknowledgeDisclosure: "true",
      }),
      now,
      repository: stores.repository,
      session,
    });

    expect(preferences.status).toBe("preferences_saved");
    expect(disclosure.status).toBe("disclosure_acknowledged");
    expect(stores.preferences[0]?.questionInterests).toEqual([
      "Books",
      "Software engineering",
    ]);
    expect(stores.disclosures).toEqual([
      { disclosureVersion: 1, now, ownerUserId: session.user.id },
    ]);
  });

  it("hard-clears every credential field on disconnect", async () => {
    const stores = createRepository({ settings: connectedSettings });

    const result = await submitQuestionGenerationSettings({
      formData: createFormData({ intent: "disconnect" }),
      now,
      repository: stores.repository,
      session,
    });

    expect(result.status).toBe("credential_disconnected");
    expect(stores.clearCalls).toEqual([{ ownerUserId: "user_1", profileId: "profile_1", now }]);
  });

  it("preserves invalid interest tags for correction", async () => {
    const stores = createRepository();
    const result = await submitQuestionGenerationSettings({
      formData: createFormData({
        intent: "save_preferences",
        modelPreference: "auto",
        questionInterests: "Books\nbooks",
      }),
      now,
      repository: stores.repository,
      session,
    });

    expect(result).toMatchObject({
      status: "invalid",
      values: { questionInterests: ["Books", "books"] },
    });
  });

  it("lazily saves rotated credential material after a successful read", async () => {
    const stores = createRepository({ settings: connectedSettings });
    const credential = await getQuestionGenerationCredential({
      decryptCredential: () => ({
        credential: "server-only-test-key",
        rotatedMaterial: credentialMaterial,
      }),
      now,
      ownerUserId: session.user.id,
      repository: stores.repository,
    });

    expect(credential).toBe("server-only-test-key");
    expect(stores.rotations).toEqual([{ ownerUserId: "user_1", material: credentialMaterial, now }]);
  });
});

function createRepository({
  settings,
}: {
  settings?: StoredQuestionGenerationSettings | undefined;
} = {}) {
  const savedCredentials: Parameters<
    QuestionGenerationSettingsRepository["saveValidatedCredential"]
  >[0][] = [];
  const preferences: Parameters<
    QuestionGenerationSettingsRepository["savePreferences"]
  >[0][] = [];
  const disclosures: Parameters<
    QuestionGenerationSettingsRepository["saveDisclosureAcknowledgement"]
  >[0][] = [];
  const clearCalls: Parameters<QuestionGenerationSettingsRepository["clearCredential"]>[0][] = [];
  const events: { action: string; outcome: string }[] = [];
  const rotations: Parameters<
    QuestionGenerationSettingsRepository["replaceCredentialMaterial"]
  >[0][] = [];

  const repository = {
    findSettings: () => Promise.resolve(settings),
    savePreferences: (input) => {
      preferences.push(input);
      return Promise.resolve();
    },
    saveValidatedCredential: (input) => {
      savedCredentials.push(input);
      return Promise.resolve();
    },
    clearCredential: (input) => {
      clearCalls.push(input);
      return Promise.resolve();
    },
    saveDisclosureAcknowledgement: (input) => {
      disclosures.push(input);
      return Promise.resolve();
    },
    replaceCredentialMaterial: (input) => {
      rotations.push(input);
      return Promise.resolve();
    },
    recordSecurityEvent: ({ action, outcome }) => {
      events.push({ action, outcome });
      return Promise.resolve();
    },
  } satisfies QuestionGenerationSettingsRepository;

  return {
    repository,
    savedCredentials,
    preferences,
    disclosures,
    clearCalls,
    events,
    rotations,
  };
}

function createFormData(values: Record<string, string>) {
  const formData = new FormData();

  for (const [key, value] of Object.entries(values)) {
    formData.set(key, value);
  }

  return formData;
}

const credentialMaterial = {
  ciphertext: "ciphertext",
  nonce: "nonce",
  authTag: "auth-tag",
  keyVersion: 1,
};

const connectedSettings = {
  ownerUserId: "user_1",
  geminiKeyCiphertext: "existing-ciphertext",
  geminiKeyNonce: "existing-nonce",
  geminiKeyAuthTag: "existing-tag",
  geminiKeyVersion: 1,
  modelPreference: "auto",
  questionInterests: [],
  credentialValidatedAt: now,
  dataDisclosureVersion: null,
  dataDisclosureAcceptedAt: null,
} satisfies StoredQuestionGenerationSettings;

const session = {
  status: "authenticated",
  profileStatus: "complete",
  suspensionStatus: "none",
  user: {
    id: "user_1",
    email: "person@example.test",
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
