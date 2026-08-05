import { describe, expect, it } from "vitest";

import {
  generateGeminiQuestions,
} from "~/features/question-generation/gemini-question-generator.server";

describe("generateGeminiQuestions", () => {
  it("uses structured JSON, explicit safety, low thinking, and Auto fallback only for a missing model", async () => {
    const models: string[] = [];
    const result = await generateGeminiQuestions({
      apiKey: "test-key",
      preference: "auto",
      requestedCount: 3,
      context: createContext(),
      clientFactory: () => ({
        models: {
          generateContent: ({ model, config }) => {
            models.push(model);
            if (models.length === 1) return Promise.reject(providerError({ status: 404 }));
            expect(config.responseMimeType).toBe("application/json");
            expect(config.safetySettings).toHaveLength(4);
            return Promise.resolve({ text: JSON.stringify({ questions: questions() }) });
          },
        },
      }),
    });

    expect(models).toEqual(["gemini-3.6-flash", "gemini-3.5-flash"]);
    expect(result.modelUsed).toBe("gemini-3.5-flash");
  });

  it("does not expose provider detail on non-fallback failures", async () => {
    await expect(
      generateGeminiQuestions({
        apiKey: "test-key",
        preference: "gemini-3.6-flash",
        requestedCount: 3,
        context: createContext(),
        clientFactory: () => ({
          models: { generateContent: () => Promise.reject(providerError({ status: 429 })) },
        }),
      }),
    ).rejects.toMatchObject({ code: "provider_quota" });
  });

  it.each([
    ["Auto auth", "auto", { status: 401 }, "provider_invalid_credential"],
    ["Auto quota", "auto", { status: 429 }, "provider_quota"],
    ["explicit unavailable", "gemini-3.6-flash", { status: 404 }, "provider_model_unavailable"],
    ["Auto timeout", "auto", { name: "TimeoutError" }, "provider_timeout"],
  ] as const)("does not fall back for %s", async (_name, preference, error, code) => {
    let calls = 0;
    await expect(generateGeminiQuestions({
      apiKey: "test-key",
      preference,
      requestedCount: 3,
      context: createContext(),
      clientFactory: () => ({ models: { generateContent: () => {
        calls += 1;
        return Promise.reject(providerError(error));
      } } }),
    })).rejects.toMatchObject({ code });
    expect(calls).toBe(1);
  });

  it("maps a failed Auto fallback without exposing provider detail", async () => {
    let calls = 0;
    await expect(generateGeminiQuestions({
      apiKey: "test-key", preference: "auto", requestedCount: 3, context: createContext(),
      clientFactory: () => ({ models: { generateContent: () => {
        calls += 1;
        return Promise.reject(providerError(calls === 1 ? { status: 404 } : { status: 429 }));
      } } }),
    })).rejects.toMatchObject({ code: "provider_quota" });
    expect(calls).toBe(2);
  });

  it("rejects malformed structured output and blocked responses", async () => {
    await expect(generateGeminiQuestions({
      apiKey: "test-key", preference: "auto", requestedCount: 3, context: createContext(),
      clientFactory: () => ({ models: { generateContent: () => Promise.resolve({
        text: JSON.stringify({ questions: questions().slice(0, 2) }),
      }) } }),
    })).rejects.toMatchObject({ code: "invalid_output" });

    await expect(generateGeminiQuestions({
      apiKey: "test-key", preference: "auto", requestedCount: 3, context: createContext(),
      clientFactory: () => ({ models: { generateContent: () => Promise.resolve({
        promptFeedback: {},
      }) } }),
    })).rejects.toMatchObject({ code: "provider_safety" });
  });
});

function createContext() {
  return {
    language: "english" as const,
    style: "balanced" as const,
    topic: "",
    profile: { displayName: "Person", bio: null },
    interests: [],
    publishedPairs: [],
  };
}

function questions() {
  return [
    { text: "What did you learn?" },
    { text: "What changed your mind?" },
    { text: "What would you try next?" },
  ];
}

function providerError(properties: Record<string, unknown>) {
  return Object.assign(new Error("provider failure"), properties);
}
