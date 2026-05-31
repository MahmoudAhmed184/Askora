import { describe, expect, it } from "vitest";

import type { CompletedProfileSessionSummary } from "~/features/auth/auth.server";
import {
  createStarterPromptQuestion,
  type StarterPromptQuestion,
  type StarterPromptStore,
} from "~/features/prompts/starter-prompts.server";

const now = new Date("2026-05-31T12:00:00.000Z");

describe("createStarterPromptQuestion", () => {
  it("creates a private starter-prompt question for the signed-in profile", async () => {
    const questions = createStarterPromptStore();

    const result = await submitStarterPrompt({
      formData: createStarterPromptFormData("casual-01"),
      store: questions.store,
    });

    expect(result).toEqual({
      status: "created",
      questionPublicId: "qst_public_1",
    });
    expect(questions.created).toEqual([
      expect.objectContaining({
        id: "question_1",
        publicId: "qst_public_1",
        recipientProfileId: "profile_1",
        recipientUserId: "user_1",
        askerUserId: null,
        askerProfileId: null,
        identityMode: "guest_anonymous",
        source: "starter_prompt",
        status: "inbox",
        originalText: "What has been taking up most of your attention lately?",
        ipHash: null,
        userAgentHash: null,
        createdAt: now,
        updatedAt: now,
      }),
    ]);
    expect(questions.created[0]?.normalizedTextHash).toEqual(expect.any(String));
    expect(questions.created[0]?.safetyFingerprintHash).toEqual(expect.any(String));
    expect(questions.created[0]?.safetyMetadataRetainUntil.toISOString()).toBe(
      "2026-06-30T12:00:00.000Z",
    );
  });

  it("denies suspended users before creating a question", async () => {
    const questions = createStarterPromptStore();

    await expect(
      submitStarterPrompt({
        formData: createStarterPromptFormData("casual-01"),
        session: {
          ...completedSession,
          suspensionStatus: "active",
        },
        store: questions.store,
      }),
    ).resolves.toMatchObject({
      status: "denied",
      reason: "suspended",
    });
    expect(questions.created).toEqual([]);
  });

  it("rejects unknown prompt ids without creating a question", async () => {
    const questions = createStarterPromptStore();

    await expect(
      submitStarterPrompt({
        formData: createStarterPromptFormData("not-a-prompt"),
        store: questions.store,
      }),
    ).resolves.toMatchObject({
      status: "invalid",
      fieldErrors: {
        promptId: "Choose a starter prompt.",
      },
    });
    expect(questions.created).toEqual([]);
  });
});

async function submitStarterPrompt({
  formData,
  session = completedSession,
  store,
}: {
  formData: FormData;
  session?: CompletedProfileSessionSummary;
  store: StarterPromptStore;
}) {
  return createStarterPromptQuestion({
    createId: () => "question_1",
    createQuestionPublicId: () => "qst_public_1",
    formData,
    now,
    session,
    store,
  });
}

function createStarterPromptFormData(promptId: string) {
  const formData = new FormData();

  formData.set("promptId", promptId);

  return formData;
}

function createStarterPromptStore() {
  const created: StarterPromptQuestion[] = [];
  const store: StarterPromptStore = {
    createQuestion(question) {
      created.push(question);
      return Promise.resolve();
    },
  };

  return {
    created,
    store,
  };
}

const completedSession = {
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
} satisfies CompletedProfileSessionSummary;
