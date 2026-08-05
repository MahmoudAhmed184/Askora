import { describe, expect, it } from "vitest";

import {
  validateGeminiCredential,
  type GeminiCredentialValidationClient,
} from "~/features/question-generation/gemini-credential-validation.server";

describe("validateGeminiCredential", () => {
  it("uses model metadata with a bounded timeout", async () => {
    let parameters: unknown;
    const result = await validateGeminiCredential({
      apiKey: "test-key",
      model: "gemini-3.6-flash",
      clientFactory: () => ({
        models: {
          get: (input) => {
            parameters = input;
            return Promise.resolve({
              name: "models/gemini-3.6-flash",
              supportedActions: ["generateContent"],
            });
          },
        },
      }),
    });

    expect(result).toEqual({ status: "validated" });
    expect(parameters).toEqual({
      model: "gemini-3.6-flash",
      config: { httpOptions: { timeout: 8_000 } },
    });
  });

  it("returns a stable safe result without provider error text", async () => {
    const result = await validateGeminiCredential({
      apiKey: "test-key",
      model: "gemini-3.6-flash",
      clientFactory: () =>
        failingClient(Object.assign(new Error("provider detail"), { status: 401 })),
    });

    expect(result).toEqual({ status: "failed", reason: "invalid_credential" });
    expect(JSON.stringify(result)).not.toContain("provider detail");
  });

  it("rejects model metadata without text generation support", async () => {
    const result = await validateGeminiCredential({
      apiKey: "test-key",
      model: "gemini-3.6-flash",
      clientFactory: () => ({
        models: {
          get: () =>
            Promise.resolve({
              name: "models/gemini-3.6-flash",
              supportedActions: ["embedContent"],
            }),
        },
      }),
    });

    expect(result).toEqual({ status: "failed", reason: "model_unavailable" });
  });
});

function failingClient(error: Error): GeminiCredentialValidationClient {
  return {
    models: {
      get: () => Promise.reject(error),
    },
  };
}
