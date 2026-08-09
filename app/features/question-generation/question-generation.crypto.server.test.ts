import { describe, expect, it } from "vitest";

import {
  QuestionGenerationCredentialError,
  createQuestionGenerationKeyring,
  decryptAndRotateQuestionGenerationCredential,
  decryptQuestionGenerationCredential,
  encryptQuestionGenerationCredential,
} from "~/features/question-generation/question-generation.crypto.server";

describe("question-generation credential encryption", () => {
  it("round trips a credential with a unique nonce", () => {
    const keyring = createTestKeyring();
    const first = encryptQuestionGenerationCredential({
      credential: "test-credential",
      keyring,
      ownerUserId: "user_1",
    });
    const second = encryptQuestionGenerationCredential({
      credential: "test-credential",
      keyring,
      ownerUserId: "user_1",
    });

    expect(decryptQuestionGenerationCredential({ keyring, material: first, ownerUserId: "user_1" })).toBe(
      "test-credential",
    );
    expect(first.nonce).not.toBe(second.nonce);
  });

  it("rejects tampered credential material without exposing secrets", () => {
    const keyring = createTestKeyring();
    const material = encryptQuestionGenerationCredential({
      credential: "test-credential",
      keyring,
      ownerUserId: "user_1",
    });

    expect(() =>
      decryptQuestionGenerationCredential({
        keyring,
        material: {
          ...material,
          authTag: `${material.authTag.startsWith("A") ? "B" : "A"}${material.authTag.slice(1)}`,
        },
        ownerUserId: "user_1",
      }),
    ).toThrow(QuestionGenerationCredentialError);
    expect(() =>
      decryptQuestionGenerationCredential({
        keyring,
        material,
        ownerUserId: "user_2",
      }),
    ).toThrow("Question-generation credential is unavailable.");
  });

  it("rejects credentials encrypted for an unavailable key version", () => {
    const material = encryptQuestionGenerationCredential({
      credential: "test-credential",
      keyring: createTestKeyring(),
      ownerUserId: "user_1",
    });
    const wrongKeyring = createQuestionGenerationKeyring({
      activeVersion: 1,
      keys: new Map([[1, Buffer.alloc(32, 2)]]),
    });

    expect(() =>
      decryptQuestionGenerationCredential({
        keyring: wrongKeyring,
        material,
        ownerUserId: "user_1",
      }),
    ).toThrow(QuestionGenerationCredentialError);
    expect(() =>
      decryptQuestionGenerationCredential({
        keyring: createTestKeyring(),
        material: { ...material, keyVersion: 99 },
        ownerUserId: "user_1",
      }),
    ).toThrow(QuestionGenerationCredentialError);
  });

  it("returns fresh encrypted material after a successful key rotation decrypt", () => {
    const oldKeyring = createQuestionGenerationKeyring({
      activeVersion: 1,
      keys: new Map([[1, Buffer.alloc(32, 1)], [2, Buffer.alloc(32, 2)]]),
    });
    const material = encryptQuestionGenerationCredential({
      credential: "test-credential",
      keyring: oldKeyring,
      ownerUserId: "user_1",
    });
    const keyring = createQuestionGenerationKeyring({
      activeVersion: 2,
      keys: new Map([[1, Buffer.alloc(32, 1)], [2, Buffer.alloc(32, 2)]]),
    });

    const decrypted = decryptAndRotateQuestionGenerationCredential({
      keyring,
      material,
      ownerUserId: "user_1",
    });

    expect(decrypted.credential).toBe("test-credential");
    expect(decrypted.rotatedMaterial?.keyVersion).toBe(2);
  });
});

function createTestKeyring() {
  return createQuestionGenerationKeyring({
    activeVersion: 1,
    keys: new Map([[1, Buffer.alloc(32, 1)]]),
  });
}
