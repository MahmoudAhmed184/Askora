import { describe, expect, it } from "vitest";

import { QuestionGenerationError } from "~/features/question-generation/question-generation.errors";
import { handleInboxGenerationAction } from "~/features/inbox/services/inbox-generation-action.server";
import type { CompletedProfileSessionSummary } from "~/features/auth/services/auth.service.server";

describe("inbox generation action", () => {
  it("passes only strict request fields and returns owner-facing question data", async () => {
    let received: unknown;
    const response = await handleInboxGenerationAction({
      formData: formData(),
      generate: ({ input }) => {
        received = input;
        return Promise.resolve({ batchId: "batch_private", questions: [{ id: "question_1", publicId: "qst_1", text: "What matters most?" }] });
      },
      session,
    });

    expect(received).toEqual({ topic: "Values", language: "english", style: "balanced", requestedCount: 5 });
    expect(response.data).toEqual({ generation: { status: "generated", questions: [{ id: "question_1", publicId: "qst_1", text: "What matters most?" }] } });
    expect(JSON.stringify(response.data)).not.toContain("batch_private");
  });

  it("maps typed failures to stable retry-safe action data", async () => {
    const response = await handleInboxGenerationAction({
      formData: formData(),
      generate: () => Promise.reject(new QuestionGenerationError("rate_limited", 45)),
      session,
    });

    expect(response.init?.status).toBe(429);
    expect(response.data).toEqual({ generation: { status: "failed", formError: "Too many generation attempts. Try again later.", retryAfterSeconds: 45 } });
  });

  it("rejects invalid request fields before invoking generation", async () => {
    const data = formData();
    data.set("requestedCount", "7");
    let called = false;
    const response = await handleInboxGenerationAction({
      formData: data,
      generate: () => {
        called = true;
        return Promise.resolve({ batchId: "", questions: [] });
      },
      session,
    });

    expect(response.init?.status).toBe(400);
    expect(called).toBe(false);
  });
});

function formData() {
  const data = new FormData();
  data.set("topic", "Values");
  data.set("language", "english");
  data.set("style", "balanced");
  data.set("requestedCount", "5");
  return data;
}

const session = {
  status: "authenticated",
  profileStatus: "complete",
  suspensionStatus: "none",
  user: { id: "user_1", email: "owner@example.test", name: "Owner", image: undefined },
  profile: { id: "profile_1", username: "owner", displayName: "Owner", avatarUrl: null },
} satisfies CompletedProfileSessionSummary;
