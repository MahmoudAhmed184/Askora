import { describe, expect, it } from "vitest";

import {
  generateQuestionBatch,
  validateGeneratedQuestions,
} from "~/features/question-generation/question-generation.service.server";
import type { QuestionGenerationRepository } from "~/features/question-generation/question-generation.repository.server";
import { QuestionGenerationCredentialError } from "~/features/question-generation/question-generation.crypto.server";
import { QuestionGenerationError } from "~/features/question-generation/question-generation.errors";

describe("question-generation service", () => {
  it("rejects contract and safety violations without retaining generated text", () => {
    expectError(() =>
      validateGeneratedQuestions({
        language: "english",
        mutedPhrases: [],
        requestedCount: 3,
        texts: ["1. First question?", "Second question?", "Third question?"],
      }),
    );
    expectError(() =>
      validateGeneratedQuestions({
        language: "english",
        mutedPhrases: [],
        requestedCount: 3,
        texts: ["What is your password?", "Second question?", "Third question?"],
      }),
    );

    for (const text of [
      "What dose of insulin should you take to lower your blood sugar?",
      "What dosage of medication should I take?",
      "Which medication should I take?",
      "How much medicine should I use?",
      "Can you tell me your passport number?",
      "What is your Social Security number?",
      "What is your government ID?",
      "What is your national identification number?",
      "What is your SSN?",
      "Which political party should people support?",
      "ما جرعة الأنسولين التي يجب أن تأخذها؟",
      "ما رقم الضمان الاجتماعي الخاص بك؟",
      "ما رقم الهوية الوطنية الخاص بك؟",
    ]) {
      expectError(() =>
        validateGeneratedQuestions({
          language: /[\u0600-\u06ff]/u.test(text) ? "modern_standard_arabic" : "english",
          mutedPhrases: [],
          requestedCount: 3,
          texts: [text, "Second question?", "Third question?"],
        }),
      );
    }
  });

  it("does not mistake harmless dosage metaphors or technology names for unsafe output", () => {
    expect(
      validateGeneratedQuestions({
        language: "english",
        mutedPhrases: [],
        requestedCount: 2,
        texts: [
          "What gives your work a dose of creativity?",
          "What do you enjoy building with Node.js?",
        ],
      }),
    ).toEqual([
      "What gives your work a dose of creativity?",
      "What do you enjoy building with Node.js?",
    ]);
  });

  it("repairs an exact 500-code-point model response with one terminal mark", () => {
    const [question] = validateGeneratedQuestions({
      language: "english",
      mutedPhrases: [],
      requestedCount: 1,
      texts: ["a".repeat(500)],
    });

    expect(question).toHaveLength(500);
    expect(question).toMatch(/\?$/u);
  });

  it("reserves the terminal mark by Unicode code point rather than UTF-16 unit", () => {
    const response = "a😀".repeat(250);
    const [question] = validateGeneratedQuestions({
      language: "english",
      mutedPhrases: [],
      requestedCount: 1,
      texts: [response],
    });

    expect(Array.from(question ?? "")).toHaveLength(500);
    expect(question).toMatch(/\?$/u);
  });

  it("runs both attempt limits before one successful provider call and persists one batch", async () => {
    const repository = createRepository();
    const rateLimitKeys: string[] = [];
    const result = await generateQuestionBatch({
      input: { topic: "", language: "english", style: "balanced", requestedCount: 3 },
      session: session(),
      repository: repository as unknown as QuestionGenerationRepository,
      getCredential: () => Promise.resolve("test-key"),
      rateLimiter: ({ key }) => {
        rateLimitKeys.push(key);
        return Promise.resolve({ allowed: true });
      },
      generate: () => Promise.resolve({
        modelUsed: "gemini-3.6-flash",
        usage: usage(),
        questions: [
          { text: "What did you learn?" },
          { text: "What changed your mind?" },
          { text: "What will you try next?" },
        ],
      }),
      createId: (() => {
        let number = 0;
        return () => `id_${String(++number)}`;
      })(),
      createQuestionPublicId: (() => {
        let number = 0;
        return () => `qst_${String(++number)}`;
      })(),
    });

    expect(rateLimitKeys).toHaveLength(2);
    expect(result.questions).toHaveLength(3);
    expect(repository.persisted).toHaveLength(1);
  });

  it("does not persist a failed duplicate precheck", async () => {
    const repository = createRepository({ existing: ["hash"] });

    await expect(
      generateQuestionBatch({
        input: { topic: "", language: "english", style: "balanced", requestedCount: 3 },
        session: session(),
        repository: repository as unknown as QuestionGenerationRepository,
        getCredential: () => Promise.resolve("test-key"),
        rateLimiter: () => Promise.resolve({ allowed: true }),
        generate: () => Promise.resolve({
          modelUsed: "gemini-3.6-flash",
          usage: usage(),
          questions: [
            { text: "What did you learn?" },
            { text: "What changed your mind?" },
            { text: "What will you try next?" },
          ],
        }),
      }),
    ).rejects.toMatchObject({ code: "duplicate" });
    expect(repository.persisted).toEqual([]);
  });

  it("checks both current and pre-PR normalized hashes before persistence", async () => {
    let candidateHashes: string[] = [];
    const repository = createRepository({
      findExisting: (hashes) => {
        candidateHashes = hashes;
        return [hashes[1] ?? "missing-legacy-hash"];
      },
    });

    await expect(
      generateQuestionBatch({
        input: {
          topic: "",
          language: "english",
          style: "balanced",
          requestedCount: 3,
        },
        session: session(),
        repository: repository as unknown as QuestionGenerationRepository,
        getCredential: () => Promise.resolve("test-key"),
        rateLimiter: () => Promise.resolve({ allowed: true }),
        generate: generator(),
      }),
    ).rejects.toMatchObject({ code: "duplicate" });

    expect(candidateHashes).toHaveLength(6);
    expect(candidateHashes[0]).not.toBe(candidateHashes[1]);
    expect(repository.persisted).toEqual([]);
  });

  it("maps a lazy credential decrypt failure without persisting", async () => {
    const repository = createRepository();

    await expect(generateQuestionBatch({
      input: { topic: "", language: "english", style: "balanced", requestedCount: 3 },
      session: session(),
      repository: repository as unknown as QuestionGenerationRepository,
      getCredential: () => Promise.reject(new QuestionGenerationCredentialError()),
      rateLimiter: () => Promise.resolve({ allowed: true }),
      generate: generator(),
    })).rejects.toMatchObject({ code: "credential_unavailable" });
    expect(repository.persisted).toEqual([]);
  });

  it("requires accepted disclosure and a previously validated credential before generating", async () => {
    for (const settings of [
      { disclosureAccepted: false, credentialValidated: true, expected: "disclosure_required" },
      { disclosureAccepted: true, credentialValidated: false, expected: "credential_required" },
    ] as const) {
      const repository = createRepository(settings);

      await expect(generateQuestionBatch({
        input: { topic: "", language: "english", style: "balanced", requestedCount: 3 },
        session: session(),
        repository: repository as unknown as QuestionGenerationRepository,
        getCredential: () => Promise.resolve("test-key"),
        rateLimiter: () => Promise.resolve({ allowed: true }),
        generate: generator(),
      })).rejects.toMatchObject({ code: settings.expected });
      expect(repository.persisted).toEqual([]);
    }
  });

  it("rejects within-batch duplicates, wrong language, markup, links, multiple questions, and muted phrases", () => {
    for (const invalid of [
      ["Repeat?", "Repeat?", "Third?"],
      ["سؤال عربي؟", "Second question?", "Third question?"],
      ["**Bold question?", "Second question?", "Third question?"],
      ["Visit example.com?", "Second question?", "Third question?"],
      ["First? Second?", "Second question?", "Third question?"],
    ]) {
      expectError(() => validateGeneratedQuestions({ language: "english", mutedPhrases: [], requestedCount: 3, texts: invalid }));
    }
    expectError(() => validateGeneratedQuestions({
      language: "english", mutedPhrases: ["blocked"], requestedCount: 3,
      texts: ["Why is this blocked?", "Second question?", "Third question?"],
    }));
  });

  it("distinguishes Egyptian Arabic from Modern Standard Arabic", () => {
    expect(
      validateGeneratedQuestions({
        language: "egyptian_arabic",
        mutedPhrases: [],
        requestedCount: 1,
        texts: ["إيه أكتر حاجة بتحبها؟"],
      }),
    ).toEqual(["إيه أكتر حاجة بتحبها؟"]);
    expect(
      validateGeneratedQuestions({
        language: "modern_standard_arabic",
        mutedPhrases: [],
        requestedCount: 1,
        texts: ["ماذا تحب أن تتعلم؟"],
      }),
    ).toEqual(["ماذا تحب أن تتعلم؟"]);

    expectError(() =>
      validateGeneratedQuestions({
        language: "egyptian_arabic",
        mutedPhrases: [],
        requestedCount: 1,
        texts: ["ماذا تحب أن تتعلم؟"],
      }),
    );
    expectError(() =>
      validateGeneratedQuestions({
        language: "modern_standard_arabic",
        mutedPhrases: [],
        requestedCount: 1,
        texts: ["إيه أكتر حاجة بتحبها؟"],
      }),
    );
  });
});

function session() {
  return {
    status: "authenticated" as const,
    profileStatus: "complete" as const,
    suspensionStatus: "none" as const,
    user: { id: "user_1", email: "person@example.com", name: "Person", image: undefined },
    profile: { id: "profile_1", username: "person", displayName: "Person", avatarUrl: null },
  };
}

function createRepository({
  existing = [],
  disclosureAccepted = true,
  credentialValidated = true,
  findExisting,
}: {
  existing?: string[];
  disclosureAccepted?: boolean;
  credentialValidated?: boolean;
  findExisting?: (hashes: string[]) => string[];
} = {}) {
  const persisted: unknown[] = [];
  return {
    persisted,
    findSettings: () => Promise.resolve({
      ownerUserId: "user_1",
      geminiKeyCiphertext: "ciphertext",
      geminiKeyNonce: "nonce",
      geminiKeyAuthTag: "tag",
      geminiKeyVersion: 1,
      modelPreference: "auto" as const,
      questionInterests: [],
      credentialValidatedAt: credentialValidated ? new Date() : null,
      dataDisclosureVersion: 1,
      dataDisclosureAcceptedAt: disclosureAccepted ? new Date() : null,
    }),
    findOwnedActiveProfile: () => Promise.resolve({
      id: "profile_1", userId: "user_1", displayName: "Person", bio: null, isActive: true,
    }),
    findPublishedPairs: () => Promise.resolve([]),
    findMutedPhrases: () => Promise.resolve([]),
    findExistingNormalizedTextHashes: ({ hashes }: { hashes: string[] }) =>
      Promise.resolve(findExisting?.(hashes) ?? existing),
    persistGeneratedBatch: (input: unknown) => {
      persisted.push(input);
      return Promise.resolve();
    },
  };
}

function usage() {
  return {
    promptTokenCount: undefined,
    candidateTokenCount: undefined,
    totalTokenCount: undefined,
  };
}

function generator() {
  return () => Promise.resolve({
    modelUsed: "gemini-3.6-flash",
    usage: usage(),
    questions: [
      { text: "What did you learn?" },
      { text: "What changed your mind?" },
      { text: "What will you try next?" },
    ],
  });
}

function expectError(action: () => unknown) {
  try {
    action();
    throw new Error("Expected a question-generation error");
  } catch (error) {
    expect(["policy_rejected", "duplicate"]).toContain(
      error instanceof QuestionGenerationError ? error.code : undefined,
    );
  }
}
